import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { readWorkPackages } from "@/lib/data/reader";
import { transformWorkPackages } from "@/lib/data/transformer";
import {
  loadForecastModel,
  loadShifts,
  loadAssumptions,
  computeDailyDemandV2,
  loadDemandContracts,
  loadCustomerNameMap,
  applyAllocations,
  generateForecast,
  bulkInsertForecastRates,
} from "@/lib/capacity";
import type { DemandWorkPackage } from "@/lib/capacity";
import { parseIntParam } from "@/lib/utils/route-helpers";
import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("api/admin/capacity/forecast-models/generate");

/**
 * POST /api/admin/capacity/forecast-models/[id]/generate
 * Generate forecast rates from historical demand. Admin only.
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await auth();
    if (!session || !["admin", "superadmin"].includes(session.user.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    const numId = parseIntParam(id);
    if (!numId) return NextResponse.json({ error: "Invalid ID" }, { status: 400 });

    const model = loadForecastModel(numId);
    if (!model) return NextResponse.json({ error: "Forecast model not found" }, { status: 404 });

    // Load capacity configuration
    const shifts = loadShifts();
    const assumptions = loadAssumptions();
    if (!assumptions) {
      return NextResponse.json({ error: "No capacity assumptions configured" }, { status: 500 });
    }

    // Compute date range: today minus lookbackDays → today
    const today = new Date().toISOString().slice(0, 10);
    const lookbackStart = new Date(
      new Date(today + "T00:00:00Z").getTime() - model.lookbackDays * 86400000,
    )
      .toISOString()
      .slice(0, 10);

    // Read and transform work packages for historical demand
    const rawData = readWorkPackages();
    const workPackages = await transformWorkPackages(rawData);

    // Filter to lookback period
    const filtered = workPackages.filter((wp) => {
      const arrival = wp.arrival.toISOString().slice(0, 10);
      const departure = wp.departure.toISOString().slice(0, 10);
      return departure >= lookbackStart && arrival <= today;
    });

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

    // Compute historical demand
    const demand = computeDailyDemandV2(demandWPs, shifts, assumptions);

    // Filter to lookback window
    const historicalDemand = demand.filter((d) => d.date >= lookbackStart && d.date <= today);

    if (historicalDemand.length === 0) {
      return NextResponse.json({
        generated: 0,
        message: "Insufficient historical data for forecast generation",
      });
    }

    // Apply contracts to historical demand (so forecast reflects allocated minimums)
    const contracts = loadDemandContracts(lookbackStart, today, true);
    let adjustedDemand = historicalDemand;
    if (contracts.length > 0) {
      const customerNameMap = loadCustomerNameMap();
      adjustedDemand = applyAllocations(historicalDemand, contracts, shifts, customerNameMap);
    }

    // Generate forecast starting tomorrow
    const forecastStart = new Date(new Date(today + "T00:00:00Z").getTime() + 86400000)
      .toISOString()
      .slice(0, 10);

    const forecastEnd = new Date(
      new Date(forecastStart + "T00:00:00Z").getTime() + (model.forecastHorizonDays - 1) * 86400000,
    )
      .toISOString()
      .slice(0, 10);

    const generatedRates = generateForecast(adjustedDemand, model, forecastStart);

    // Bulk-insert (replaces existing non-manual rates)
    const userId = Number(session.user.id);
    const count = bulkInsertForecastRates(numId, generatedRates, userId);

    log.info(
      { modelId: numId, generated: count, forecastStart, forecastEnd },
      "Forecast rates generated",
    );

    return NextResponse.json({
      generated: count,
      forecastStart,
      forecastEnd,
      historicalDays: adjustedDemand.length,
    });
  } catch (error) {
    log.error({ err: error }, "Error generating forecast rates");
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
