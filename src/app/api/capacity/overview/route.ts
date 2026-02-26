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
  loadDemandContracts,
  loadCustomerNameMap,
  applyAllocations,
  loadActiveStaffingConfig,
  loadStaffingShifts,
  loadRotationPatterns,
  buildPatternMap,
  resolveStaffingForCapacity,
  loadFlightEvents,
  computeAllEventWindows,
  computeConcurrencyPressure,
  expandRecurringEvent,
  aggregateConcurrencyByDay,
  aggregateConcurrencyByShift,
  applyConcurrencyPressure,
  loadActiveForecastModel,
  loadForecastRates,
  applyForecastRates,
  loadTimeBookings,
  aggregateWorkedHours,
  applyWorkedHours,
  loadBillingEntries,
  aggregateBilledHours,
  applyBilledHours,
  computeEffectivePaidHours,
  deriveNonOperatingFromStaffing,
} from "@/lib/capacity";
import type { DemandWorkPackage } from "@/lib/capacity";
import type { ResolvedShiftInfo, CapacityComputeMode } from "@/types";
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
    const modeOverride = searchParams.get("mode") as CapacityComputeMode | null;

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

    // Compute capacity: detect auto mode from DB, then apply override if requested.
    const activeConfig = loadActiveStaffingConfig();
    const autoMode: CapacityComputeMode = activeConfig ? "staffing" : "headcount";
    const computeMode: CapacityComputeMode = modeOverride ?? autoMode;
    let capacity;
    let resolvedShifts: ResolvedShiftInfo[];
    let modeWarning: string | undefined;
    let staffingMap:
      | Map<string, Map<string, { headcount: number; effectivePaidHours: number }>>
      | undefined;

    if (computeMode === "staffing") {
      if (activeConfig) {
        const staffingShifts = loadStaffingShifts(activeConfig.id);
        const patterns = loadRotationPatterns(true);
        const patternMap = buildPatternMap(patterns);
        staffingMap = resolveStaffingForCapacity(dates, staffingShifts, patternMap);
        capacity = computeDailyCapacityFromStaffing(dates, shifts, staffingMap, assumptions);
        resolvedShifts = staffingShifts
          .filter((ss) => ss.isActive)
          .map((ss) => ({
            code: ss.category,
            name: ss.name,
            startHour: ss.startHour,
            startMinute: ss.startMinute,
            endHour: ss.endHour,
            endMinute: ss.endMinute,
            effectivePaidHours: computeEffectivePaidHours(ss),
            breakMinutes: ss.breakMinutes,
            lunchMinutes: ss.lunchMinutes,
            headcount: ss.headcount,
            mhOverride: ss.mhOverride,
            isActive: ss.isActive,
            source: "staffing" as const,
          }));
      } else {
        // User requested staffing mode but no active config exists
        modeWarning = "No active staffing configuration found. Rotation capacity is zero.";
        capacity = dates.map((date) => ({
          date,
          totalProductiveMH: 0,
          totalPaidMH: 0,
          byShift: shifts
            .filter((s) => s.isActive)
            .map((s) => ({
              shiftCode: s.code,
              shiftName: s.name,
              rosterHeadcount: 0,
              effectiveHeadcount: 0,
              paidHoursPerPerson: s.paidHours,
              paidMH: 0,
              availableMH: 0,
              productiveMH: 0,
              hasExceptions: false,
              belowMinHeadcount: false,
            })),
          hasExceptions: false,
        }));
        resolvedShifts = [];
      }
    } else {
      // headcount mode
      const plans = loadPlans(startDate, endDate);
      const exceptions = loadExceptions(startDate, endDate);
      capacity = computeDailyCapacityV2(dates, shifts, plans, exceptions, assumptions);

      // Check if headcount plans exist — if empty, warn
      if (plans.length === 0) {
        modeWarning = "No headcount plans found for this date range. Headcount capacity is zero.";
      }

      resolvedShifts = shifts
        .filter((s) => s.isActive)
        .map((s) => ({
          code: s.code,
          name: s.name,
          startHour: s.startHour,
          startMinute: 0,
          endHour: s.endHour,
          endMinute: 0,
          effectivePaidHours: s.paidHours,
          breakMinutes: 0,
          lunchMinutes: 0,
          headcount: 0,
          mhOverride: null,
          isActive: s.isActive,
          source: "capacity" as const,
        }));
    }

    // Derive non-operating shifts (staffing mode only — rotation provides schedule truth)
    let nonOperatingShifts = new Map<string, Set<string>>();
    let scheduleSource: "staffing" | "headcount" | "none" = "none";

    if (computeMode === "staffing" && staffingMap) {
      nonOperatingShifts = deriveNonOperatingFromStaffing(
        staffingMap,
        shifts.filter((s) => s.isActive).map((s) => s.code),
      );
      scheduleSource = "staffing";
    } else if (computeMode === "headcount") {
      scheduleSource = "headcount";
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
    const demand = computeDailyDemandV2(demandWPs, shifts, assumptions, nonOperatingShifts).filter(
      (d) => dateSet.has(d.date),
    );

    // Load active contracts for date range and apply allocations to demand
    const contracts = loadDemandContracts(startDate, endDate, true);
    let adjustedDemand = demand;
    if (contracts.length > 0) {
      const customerNameMap = loadCustomerNameMap();
      adjustedDemand = applyAllocations(
        demand,
        contracts,
        shifts,
        customerNameMap,
        nonOperatingShifts,
      );
    }

    // Load flight events, expand recurring templates, and compute coverage windows
    const rawFlightEvents = loadFlightEvents(startDate, endDate, true);

    // Separate recurring templates from specific (one-off) events
    const recurringTemplates = rawFlightEvents.filter((e) => e.isRecurring);
    const specificEvents = rawFlightEvents.filter((e) => !e.isRecurring);

    // Build natural-key lookup for auto-suppress
    // Key = aircraftReg (flight number) + customer + date
    const specificByKey = new Set(
      specificEvents
        .filter((e) => e.aircraftReg)
        .flatMap((e) => {
          const dates = [
            e.scheduledArrival?.slice(0, 10),
            e.scheduledDeparture?.slice(0, 10),
            e.actualArrival?.slice(0, 10),
            e.actualDeparture?.slice(0, 10),
          ].filter(Boolean) as string[];
          return dates.map((d) => `${e.aircraftReg}|${e.customer}|${d}`);
        }),
    );

    // Expand recurring templates, skipping auto-suppressed dates
    const expandedFromTemplates = recurringTemplates.flatMap((template) =>
      expandRecurringEvent(template, startDate, endDate).filter((instance) => {
        const instanceDate =
          instance.scheduledArrival?.slice(0, 10) ?? instance.scheduledDeparture?.slice(0, 10);
        if (!instanceDate || !template.aircraftReg) return true;
        const key = `${template.aircraftReg}|${template.customer}|${instanceDate}`;
        return !specificByKey.has(key); // auto-suppress if specific event exists
      }),
    );

    const flightEvents = [...specificEvents, ...expandedFromTemplates];
    const coverageWindows =
      flightEvents.length > 0
        ? computeAllEventWindows(flightEvents, startDate, endDate)
        : undefined;

    // Compute concurrency pressure from flight events (P2-4)
    const concurrencyBuckets =
      flightEvents.length > 0
        ? computeConcurrencyPressure(flightEvents, startDate, endDate)
        : undefined;

    if (concurrencyBuckets && concurrencyBuckets.length > 0) {
      const dailyConcurrency = aggregateConcurrencyByDay(concurrencyBuckets);
      const shiftConcurrency = aggregateConcurrencyByShift(
        concurrencyBuckets,
        shifts,
        nonOperatingShifts,
      );
      adjustedDemand = applyConcurrencyPressure(adjustedDemand, dailyConcurrency, shiftConcurrency);
    }

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

    // Load billing entries and overlay billed hours on demand
    const billingEntries = loadBillingEntries(startDate, endDate, true);
    if (billingEntries.length > 0) {
      const billedAgg = aggregateBilledHours(billingEntries, startDate, endDate);
      adjustedDemand = applyBilledHours(adjustedDemand, billedAgg);
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
      contracts: contracts.length > 0 ? contracts : undefined,
      flightEvents: flightEvents.length > 0 ? flightEvents : undefined,
      coverageWindows: coverageWindows && coverageWindows.length > 0 ? coverageWindows : undefined,
      concurrencyBuckets:
        concurrencyBuckets && concurrencyBuckets.length > 0 ? concurrencyBuckets : undefined,
      forecastRates: forecastRates && forecastRates.length > 0 ? forecastRates : undefined,
      forecastModel: activeForecastModel ?? undefined,
      timeBookings: timeBookings.length > 0 ? timeBookings : undefined,
      billingEntries: billingEntries.length > 0 ? billingEntries : undefined,
      computeMode,
      resolvedShifts,
      activeStaffingConfigName: activeConfig?.name ?? undefined,
      autoMode,
      modeWarning,
      shiftRouting: {
        scheduleSource,
        nonOperatingShifts: Object.fromEntries(
          Array.from(nonOperatingShifts.entries()).map(([d, s]) => [d, Array.from(s)]),
        ),
        modeWarning: modeWarning ?? null,
      },
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
