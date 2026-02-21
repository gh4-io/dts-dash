import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import { applyFilters, parseFilterParams } from "@/lib/utils/filter-helpers";
import {
  loadShifts,
  loadAssumptions,
  loadPlans,
  loadExceptions,
  computeDailyCapacityV2,
  computeDailyCapacityFromStaffing,
  computeUtilizationV2,
  validateHeadcountCoverage,
  computeCapacitySummary,
  computeDailyDemandV2,
  loadDemandAllocations,
  loadCustomerNameMap,
  applyAllocations,
  loadActiveStaffingConfig,
  loadStaffingShifts,
  loadRotationPatterns,
  buildPatternMap,
  resolveStaffingForCapacity,
  loadFlightEvents,
  computeAllEventWindows,
  loadActiveForecastModel,
  loadForecastRates,
  applyForecastRates,
  loadTimeBookings,
  aggregateWorkedHours,
  applyWorkedHours,
} from "@/lib/capacity";
import type { DemandWorkPackage } from "@/lib/capacity";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/capacity/overview");

/**
 * GET /api/capacity/overview
 * Full capacity + demand + utilization with per-shift drilldown data.
 * Accepts same filter params as /api/capacity (start, end, operators, aircraft, types).
 * Requires authentication.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const filterParams = parseFilterParams(searchParams);

    // Load capacity configuration from DB
    const shifts = loadShifts();
    const assumptions = loadAssumptions();

    if (!assumptions) {
      return NextResponse.json(
        { error: "No capacity assumptions configured. Please seed default data." },
        { status: 500 },
      );
    }

    // Determine date range from filters or default to 30 days
    // Filter store sends full ISO datetimes (e.g. "2026-02-20T15:00:00.000Z")
    // but date-range/plan queries need YYYY-MM-DD only.
    const startDate = toDateOnly(filterParams.start ?? getDefaultStartDate());
    const endDate = toDateOnly(filterParams.end ?? getDefaultEndDate());

    // Generate date array
    const dates = generateDateRange(startDate, endDate);

    // Compute capacity: use active staffing config (rotation-based) if available,
    // otherwise fall back to simple headcount plans.
    const activeConfig = loadActiveStaffingConfig();
    let capacity;

    if (activeConfig) {
      const staffingShifts = loadStaffingShifts(activeConfig.id);
      const patterns = loadRotationPatterns(true);
      const patternMap = buildPatternMap(patterns);
      const staffingMap = resolveStaffingForCapacity(dates, staffingShifts, patternMap);
      capacity = computeDailyCapacityFromStaffing(dates, shifts, staffingMap, assumptions);
    } else {
      const plans = loadPlans(startDate, endDate);
      const exceptions = loadExceptions(startDate, endDate);
      capacity = computeDailyCapacityV2(dates, shifts, plans, exceptions, assumptions);
    }

    // Read and transform work packages, apply filters for demand
    const rawData = readWorkPackages();
    const workPackages = await transformWorkPackages(rawData);
    const filtered = applyFilters(workPackages, filterParams);

    // Convert to DemandWorkPackage format
    const demandWPs: DemandWorkPackage[] = filtered.map((wp) => ({
      id: wp.id,
      aircraftReg: wp.aircraftReg,
      customer: wp.customer,
      arrival: wp.arrival.toISOString(),
      departure: wp.departure.toISOString(),
      effectiveMH: wp.effectiveMH,
      mhSource: wp.mhSource,
    }));

    // Compute demand with distribution, then clamp to the requested date range.
    // WPs that overlap the filter can extend ground-time beyond [startDate, endDate];
    // without clamping, extra dates leak into the heatmap with no capacity data.
    const dateSet = new Set(dates);
    const demand = computeDailyDemandV2(demandWPs, shifts, assumptions).filter((d) =>
      dateSet.has(d.date),
    );

    // Load active allocations for date range and apply to demand
    const allocations = loadDemandAllocations(startDate, endDate, true);
    let adjustedDemand = demand;
    if (allocations.length > 0) {
      const customerNameMap = loadCustomerNameMap();
      adjustedDemand = applyAllocations(demand, allocations, shifts, customerNameMap);
    }

    // Load flight events and compute coverage windows for date range
    const flightEvents = loadFlightEvents(startDate, endDate, true);
    const coverageWindows =
      flightEvents.length > 0
        ? computeAllEventWindows(flightEvents, startDate, endDate)
        : undefined;

    // Load active forecast model and overlay rates on demand
    const activeForecastModel = loadActiveForecastModel();
    let forecastRates;
    if (activeForecastModel) {
      const rates = loadForecastRates(activeForecastModel.id, startDate, endDate, true);
      if (rates.length > 0) {
        forecastRates = rates;
        adjustedDemand = applyForecastRates(
          adjustedDemand,
          rates,
          activeForecastModel.granularity as "daily" | "shift",
        );
      }
    }

    // Load time bookings and overlay worked hours on demand
    const timeBookings = loadTimeBookings(startDate, endDate, true);
    if (timeBookings.length > 0) {
      const workedAgg = aggregateWorkedHours(timeBookings, startDate, endDate);
      adjustedDemand = applyWorkedHours(adjustedDemand, workedAgg);
    }

    // Compute utilization
    const utilization = computeUtilizationV2(adjustedDemand, capacity);

    // Compute summary and warnings
    const summary = computeCapacitySummary(utilization);
    const warnings = validateHeadcountCoverage(capacity, shifts);

    return NextResponse.json({
      demand: adjustedDemand,
      capacity,
      utilization,
      summary,
      warnings,
      shifts,
      assumptions,
      allocations: allocations.length > 0 ? allocations : undefined,
      flightEvents: flightEvents.length > 0 ? flightEvents : undefined,
      coverageWindows: coverageWindows && coverageWindows.length > 0 ? coverageWindows : undefined,
      forecastRates: forecastRates && forecastRates.length > 0 ? forecastRates : undefined,
      forecastModel: activeForecastModel ?? undefined,
      timeBookings: timeBookings.length > 0 ? timeBookings : undefined,
    });
  } catch (error) {
    log.error({ err: error }, "Error computing capacity overview");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function getDefaultStartDate(): string {
  const d = new Date();
  d.setDate(d.getDate() - 7);
  return d.toISOString().split("T")[0];
}

function getDefaultEndDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 23);
  return d.toISOString().split("T")[0];
}

/** Extract YYYY-MM-DD from an ISO datetime or date-only string. */
function toDateOnly(s: string): string {
  return s.split("T")[0].split(" ")[0];
}

function generateDateRange(start: string, end: string): string[] {
  const dates: string[] = [];
  const startStr = toDateOnly(start);
  const endStr = toDateOnly(end);
  const current = new Date(startStr + "T00:00:00Z");
  const endDate = new Date(endStr + "T00:00:00Z");

  while (current <= endDate) {
    dates.push(current.toISOString().split("T")[0]);
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}
