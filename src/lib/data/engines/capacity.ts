import type {
  WorkPackage,
  DailyDemand,
  DailyCapacity,
  DailyUtilization,
  ShiftDefinition,
  ShiftCapacity,
} from "@/types";

/**
 * Capacity Computation Engine
 * Computes daily demand, capacity, and utilization
 * Demand is filtered by customer/aircraft/type; capacity is NOT filtered
 */

export interface CapacityConfig {
  shifts: ShiftDefinition[];
  theoreticalCapacityPerPerson: number;
  realCapacityPerPerson: number;
}

/**
 * Compute daily demand from work packages
 * Demand = sum of effectiveMH for all aircraft on-ground on that date
 */
export function computeDailyDemand(workPackages: WorkPackage[]): DailyDemand[] {
  if (workPackages.length === 0) {
    return [];
  }

  // Group by date (arrival date)
  const demandByDate = new Map<string, { totalMH: number; aircraftSet: Set<string>; byCustomer: Map<string, number> }>();

  workPackages.forEach((wp) => {
    // Each WP contributes demand on all days it's on-ground
    const arrivalDate = new Date(wp.arrival);
    const departureDate = new Date(wp.departure);

    const currentDate = new Date(arrivalDate);
    currentDate.setHours(0, 0, 0, 0);

    const endDate = new Date(departureDate);
    endDate.setHours(0, 0, 0, 0);

    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split("T")[0];

      if (!demandByDate.has(dateKey)) {
        demandByDate.set(dateKey, {
          totalMH: 0,
          aircraftSet: new Set(),
          byCustomer: new Map(),
        });
      }

      const dayData = demandByDate.get(dateKey)!;
      dayData.totalMH += wp.effectiveMH;
      dayData.aircraftSet.add(wp.aircraftReg);

      const customerMH = dayData.byCustomer.get(wp.customer) ?? 0;
      dayData.byCustomer.set(wp.customer, customerMH + wp.effectiveMH);

      currentDate.setDate(currentDate.getDate() + 1);
    }
  });

  // Convert to array
  const demand: DailyDemand[] = Array.from(demandByDate.entries())
    .map(([date, data]) => ({
      date,
      totalDemandMH: data.totalMH,
      aircraftCount: data.aircraftSet.size,
      byCustomer: Object.fromEntries(data.byCustomer),
    }))
    .sort((a, b) => a.date.localeCompare(b.date));

  return demand;
}

/**
 * Compute daily capacity (constant across all dates)
 * Capacity is NOT filtered by customer/aircraft/type
 */
export function computeDailyCapacity(
  dates: string[],
  config: CapacityConfig
): DailyCapacity[] {
  return dates.map((date) => {
    const byShift: ShiftCapacity[] = config.shifts.map((shift) => {
      const shiftHours = calculateShiftHours(shift.startHour, shift.endHour);
      const theoreticalMH = shift.headcount * shiftHours;
      const realMH = shift.headcount * config.realCapacityPerPerson;

      return {
        shift: shift.name,
        headcount: shift.headcount,
        theoreticalMH,
        realMH,
      };
    });

    const theoreticalCapacityMH = byShift.reduce((sum, s) => sum + s.theoreticalMH, 0);
    const realCapacityMH = byShift.reduce((sum, s) => sum + s.realMH, 0);

    return {
      date,
      theoreticalCapacityMH,
      realCapacityMH,
      byShift,
    };
  });
}

/**
 * Compute daily utilization (demand / capacity)
 */
export function computeDailyUtilization(
  demand: DailyDemand[],
  capacity: DailyCapacity[]
): DailyUtilization[] {
  const capacityMap = new Map(capacity.map((c) => [c.date, c]));

  return demand.map((d) => {
    const cap = capacityMap.get(d.date);
    if (!cap) {
      return {
        date: d.date,
        utilizationPercent: 0,
        surplusDeficitMH: 0,
        overtimeFlag: false,
        criticalFlag: false,
      };
    }

    const utilizationPercent =
      cap.realCapacityMH > 0 ? (d.totalDemandMH / cap.realCapacityMH) * 100 : 0;
    const surplusDeficitMH = cap.realCapacityMH - d.totalDemandMH;
    const overtimeFlag = utilizationPercent > 100;
    const criticalFlag = utilizationPercent > 120;

    return {
      date: d.date,
      utilizationPercent,
      surplusDeficitMH,
      overtimeFlag,
      criticalFlag,
    };
  });
}

/**
 * Calculate shift duration in hours
 * Handles overnight shifts (e.g., Night 23-07 = 8 hours)
 */
function calculateShiftHours(startHour: number, endHour: number): number {
  if (endHour > startHour) {
    return endHour - startHour;
  } else {
    // Overnight shift
    return 24 - startHour + endHour;
  }
}
