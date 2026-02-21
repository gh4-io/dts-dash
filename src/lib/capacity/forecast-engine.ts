/**
 * Forecast Engine — P2-5 Rate Forecast
 *
 * Pure functions for demand forecasting. Zero DB imports.
 * Algorithms: moving average, weighted average, linear trend.
 */

import type {
  DailyDemandV2,
  ShiftDemandV2,
  ForecastModel,
  ForecastRate,
  ForecastGranularity,
  GeneratedForecastRate,
} from "@/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

const VALID_METHODS = ["moving_average", "weighted_average", "linear_trend"] as const;
const VALID_GRANULARITIES = ["daily", "shift"] as const;
const VALID_SHIFT_CODES = ["DAY", "SWING", "NIGHT"];
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Add N days to a YYYY-MM-DD date string */
function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

// ─── Statistical Functions ───────────────────────────────────────────────────

/**
 * Compute simple arithmetic mean of values.
 * Returns 0 for empty array.
 */
export function computeMovingAverage(values: number[]): number {
  if (values.length === 0) return 0;
  const sum = values.reduce((a, b) => a + b, 0);
  return sum / values.length;
}

/**
 * Compute weighted average with exponential decay.
 * `weightRecent` controls how much to favor recent data (last element = most recent).
 * Weight for item i (from end) = weightRecent^i, normalized to sum to 1.
 * Returns 0 for empty array.
 */
export function computeWeightedAverage(values: number[], weightRecent: number): number {
  if (values.length === 0) return 0;
  if (values.length === 1) return values[0];

  // values[last] = most recent → weight = weightRecent^0 = 1
  // values[last-1] → weight = weightRecent^1
  // etc.
  let totalWeight = 0;
  let weightedSum = 0;
  for (let i = 0; i < values.length; i++) {
    const distFromEnd = values.length - 1 - i;
    const w = Math.pow(weightRecent, distFromEnd);
    weightedSum += values[i] * w;
    totalWeight += w;
  }

  return totalWeight > 0 ? weightedSum / totalWeight : 0;
}

/**
 * Fit a linear regression y = mx + b via least squares.
 * Values are assumed to be evenly spaced (x = 0, 1, 2, ...).
 * Returns slope, intercept, R², and a predict function.
 */
export function fitLinearRegression(values: number[]): {
  slope: number;
  intercept: number;
  rSquared: number;
  predict: (x: number) => number;
} {
  const n = values.length;
  if (n === 0) {
    return { slope: 0, intercept: 0, rSquared: 0, predict: () => 0 };
  }
  if (n === 1) {
    return { slope: 0, intercept: values[0], rSquared: 1, predict: () => values[0] };
  }

  // x = 0, 1, 2, ... n-1
  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumX2 = 0;

  for (let i = 0; i < n; i++) {
    sumX += i;
    sumY += values[i];
    sumXY += i * values[i];
    sumX2 += i * i;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;
  const denom = sumX2 - n * meanX * meanX;

  const slope = denom !== 0 ? (sumXY - n * meanX * meanY) / denom : 0;
  const intercept = meanY - slope * meanX;

  // R²
  let ssTot = 0;
  let ssRes = 0;
  for (let i = 0; i < n; i++) {
    const predicted = slope * i + intercept;
    ssTot += (values[i] - meanY) ** 2;
    ssRes += (values[i] - predicted) ** 2;
  }
  const rSquared = ssTot > 0 ? 1 - ssRes / ssTot : 1;

  return {
    slope,
    intercept,
    rSquared: Math.max(0, Math.min(1, rSquared)),
    predict: (x: number) => slope * x + intercept,
  };
}

// ─── Historical Series Extraction ────────────────────────────────────────────

/**
 * Extract a demand time series for a specific shift/customer from historical daily demand.
 * - shiftCode=null + customer=null → aggregate totalDemandMH
 * - shiftCode set → filter to that shift's demandMH
 * - customer set → filter byCustomer map
 * Returns sorted by date ascending.
 */
export function extractHistoricalSeries(
  demand: DailyDemandV2[],
  shiftCode: string | null,
  customer: string | null,
): Array<{ date: string; demandMH: number }> {
  const sorted = [...demand].sort((a, b) => a.date.localeCompare(b.date));

  return sorted.map((day) => {
    let mh: number;

    if (shiftCode && customer) {
      // Specific shift + customer: find shift, then look at wpContributions
      const shift = day.byShift.find((s) => s.shiftCode === shiftCode);
      if (shift) {
        mh = shift.wpContributions
          .filter((c) => c.customer === customer)
          .reduce((sum, c) => sum + c.allocatedMH, 0);
      } else {
        mh = 0;
      }
    } else if (shiftCode) {
      // Specific shift, all customers
      const shift = day.byShift.find((s) => s.shiftCode === shiftCode);
      mh = shift ? shift.demandMH : 0;
    } else if (customer) {
      // All shifts, specific customer
      mh = day.byCustomer[customer] ?? 0;
    } else {
      // Aggregate
      mh = day.totalDemandMH;
    }

    return { date: day.date, demandMH: mh };
  });
}

// ─── Forecast Generation ─────────────────────────────────────────────────────

/**
 * Generate forecast rates from historical demand data using the model's configuration.
 *
 * @param historicalDemand DailyDemandV2[] for the lookback window
 * @param model ForecastModel configuration
 * @param forecastStartDate First date to forecast (YYYY-MM-DD), typically "tomorrow"
 * @returns GeneratedForecastRate[] for each (date, shift?, customer?) in the forecast horizon
 */
export function generateForecast(
  historicalDemand: DailyDemandV2[],
  model: ForecastModel,
  forecastStartDate: string,
): GeneratedForecastRate[] {
  if (historicalDemand.length === 0) return [];

  // Determine which customers to forecast
  const customers = resolveCustomers(historicalDemand, model.customerFilter);

  // Determine shift codes based on granularity
  const shiftCodes: (string | null)[] =
    model.granularity === "shift" ? resolveShiftCodes(historicalDemand) : [null];

  const results: GeneratedForecastRate[] = [];

  for (const shiftCode of shiftCodes) {
    for (const customer of customers) {
      const series = extractHistoricalSeries(historicalDemand, shiftCode, customer);
      const values = series.map((s) => s.demandMH);

      if (values.length === 0) continue;

      const forecasted = applyMethod(values, model);

      for (let dayOffset = 0; dayOffset < model.forecastHorizonDays; dayOffset++) {
        const forecastDate = addDays(forecastStartDate, dayOffset);
        const { mh, confidence } = forecasted[dayOffset] ?? forecasted[forecasted.length - 1];

        results.push({
          forecastDate,
          shiftCode,
          customer,
          forecastedMh: Math.round(mh * 100) / 100,
          confidence: Math.round(confidence * 100) / 100,
        });
      }
    }
  }

  return results;
}

/** Resolve which customers to forecast */
function resolveCustomers(
  demand: DailyDemandV2[],
  customerFilter: string | null,
): (string | null)[] {
  if (customerFilter) {
    return customerFilter
      .split(",")
      .map((c) => c.trim())
      .filter((c) => c.length > 0);
  }
  // null = aggregate forecast (all customers combined)
  return [null];
}

/** Resolve unique shift codes from historical demand */
function resolveShiftCodes(demand: DailyDemandV2[]): string[] {
  const codes = new Set<string>();
  for (const day of demand) {
    for (const shift of day.byShift) {
      codes.add(shift.shiftCode);
    }
  }
  const sorted = Array.from(codes).sort();
  return sorted.length > 0 ? sorted : ["DAY", "SWING", "NIGHT"];
}

/** Apply the selected forecasting method */
function applyMethod(
  values: number[],
  model: ForecastModel,
): Array<{ mh: number; confidence: number }> {
  const sampleConfidence = Math.min(values.length / model.lookbackDays, 1.0);

  switch (model.method) {
    case "moving_average": {
      const avg = computeMovingAverage(values);
      return Array.from({ length: model.forecastHorizonDays }, () => ({
        mh: avg,
        confidence: sampleConfidence,
      }));
    }

    case "weighted_average": {
      const avg = computeWeightedAverage(values, model.weightRecent);
      return Array.from({ length: model.forecastHorizonDays }, () => ({
        mh: avg,
        confidence: sampleConfidence * 0.9,
      }));
    }

    case "linear_trend": {
      const regression = fitLinearRegression(values);
      const n = values.length;
      return Array.from({ length: model.forecastHorizonDays }, (_, i) => ({
        mh: Math.max(0, regression.predict(n + i)),
        confidence: regression.rSquared < 0.1 ? 0.05 : regression.rSquared,
      }));
    }

    default:
      return [];
  }
}

// ─── Apply Forecast Rates ────────────────────────────────────────────────────

/**
 * Overlay forecast rates onto demand data.
 * - For dates that exist in demand: adds forecastedDemandMH as parallel comparison
 * - For pure future dates: creates synthetic DailyDemandV2 entries
 * Does NOT modify totalDemandMH — forecast is informational only.
 * Returns a new array (immutable).
 */
export function applyForecastRates(
  demand: DailyDemandV2[],
  rates: ForecastRate[],
  granularity: ForecastGranularity,
): DailyDemandV2[] {
  if (rates.length === 0) return demand;

  // Group rates by date
  const ratesByDate = new Map<string, ForecastRate[]>();
  for (const rate of rates) {
    const existing = ratesByDate.get(rate.forecastDate) ?? [];
    existing.push(rate);
    ratesByDate.set(rate.forecastDate, existing);
  }

  // Index existing demand by date
  const demandByDate = new Map<string, DailyDemandV2>();
  for (const d of demand) {
    demandByDate.set(d.date, d);
  }

  const result: DailyDemandV2[] = demand.map((d) => {
    const dateRates = ratesByDate.get(d.date);
    if (!dateRates) return d;

    const totalForecast = dateRates.reduce((sum, r) => sum + r.forecastedMh, 0);
    const byShift = applyShiftForecasts(d.byShift, dateRates, granularity);

    return {
      ...d,
      totalForecastedDemandMH: Math.round(totalForecast * 100) / 100,
      byShift,
    };
  });

  // Add synthetic entries for future dates not in demand
  for (const [date, dateRates] of ratesByDate) {
    if (demandByDate.has(date)) continue;

    const totalForecast = dateRates.reduce((sum, r) => sum + r.forecastedMh, 0);
    const byShift = buildSyntheticShifts(dateRates, granularity);

    result.push({
      date,
      totalDemandMH: 0,
      totalForecastedDemandMH: Math.round(totalForecast * 100) / 100,
      aircraftCount: 0,
      byCustomer: {},
      byShift,
    });
  }

  return result.sort((a, b) => a.date.localeCompare(b.date));
}

/** Add forecastedDemandMH to existing shift demand entries */
function applyShiftForecasts(
  shifts: ShiftDemandV2[],
  rates: ForecastRate[],
  granularity: ForecastGranularity,
): ShiftDemandV2[] {
  if (granularity === "daily") {
    // Daily granularity: distribute total evenly across shifts
    const totalForecast = rates.reduce((sum, r) => sum + r.forecastedMh, 0);
    const perShift = shifts.length > 0 ? totalForecast / shifts.length : 0;
    return shifts.map((s) => ({
      ...s,
      forecastedDemandMH: Math.round(perShift * 100) / 100,
    }));
  }

  // Shift granularity: match rates to shifts
  return shifts.map((s) => {
    const matchingRate = rates.find((r) => r.shiftCode === s.shiftCode);
    return matchingRate
      ? { ...s, forecastedDemandMH: Math.round(matchingRate.forecastedMh * 100) / 100 }
      : s;
  });
}

/** Build synthetic shift entries for future dates */
function buildSyntheticShifts(
  rates: ForecastRate[],
  granularity: ForecastGranularity,
): ShiftDemandV2[] {
  if (granularity === "daily") {
    // No shift breakdown for daily granularity
    return [];
  }

  // Group rates by shift code
  const byShift = new Map<string, number>();
  for (const r of rates) {
    if (r.shiftCode) {
      byShift.set(r.shiftCode, (byShift.get(r.shiftCode) ?? 0) + r.forecastedMh);
    }
  }

  return Array.from(byShift.entries()).map(([code, mh]) => ({
    shiftCode: code,
    demandMH: 0,
    forecastedDemandMH: Math.round(mh * 100) / 100,
    wpContributions: [],
  }));
}

// ─── Validation ──────────────────────────────────────────────────────────────

/** Validate a forecast model configuration */
export function validateForecastModel(data: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.name || typeof data.name !== "string" || !data.name.trim()) {
    errors.push("name is required");
  }

  if (!data.method || !VALID_METHODS.includes(data.method as (typeof VALID_METHODS)[number])) {
    errors.push(`method must be one of: ${VALID_METHODS.join(", ")}`);
  }

  if (data.lookbackDays !== undefined) {
    const lb = Number(data.lookbackDays);
    if (!Number.isInteger(lb) || lb < 7 || lb > 365) {
      errors.push("lookbackDays must be an integer between 7 and 365");
    }
  }

  if (data.forecastHorizonDays !== undefined) {
    const fh = Number(data.forecastHorizonDays);
    if (!Number.isInteger(fh) || fh < 1 || fh > 90) {
      errors.push("forecastHorizonDays must be an integer between 1 and 90");
    }
  }

  if (
    data.granularity !== undefined &&
    !VALID_GRANULARITIES.includes(data.granularity as (typeof VALID_GRANULARITIES)[number])
  ) {
    errors.push(`granularity must be one of: ${VALID_GRANULARITIES.join(", ")}`);
  }

  if (data.weightRecent !== undefined) {
    const wr = Number(data.weightRecent);
    if (isNaN(wr) || wr < 0 || wr > 1) {
      errors.push("weightRecent must be a number between 0.0 and 1.0");
    }
  }

  return { valid: errors.length === 0, errors };
}

/** Validate a forecast rate entry */
export function validateForecastRate(data: Record<string, unknown>): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (!data.modelId || typeof data.modelId !== "number" || data.modelId <= 0) {
    errors.push("modelId is required and must be a positive integer");
  }

  if (
    !data.forecastDate ||
    typeof data.forecastDate !== "string" ||
    !DATE_RE.test(data.forecastDate)
  ) {
    errors.push("forecastDate is required in YYYY-MM-DD format");
  }

  if (data.shiftCode !== undefined && data.shiftCode !== null) {
    if (!VALID_SHIFT_CODES.includes(data.shiftCode as string)) {
      errors.push(`shiftCode must be one of: ${VALID_SHIFT_CODES.join(", ")}`);
    }
  }

  if (data.forecastedMh === undefined || data.forecastedMh === null) {
    errors.push("forecastedMh is required");
  } else if (typeof data.forecastedMh !== "number" || data.forecastedMh < 0) {
    errors.push("forecastedMh must be a non-negative number");
  }

  if (data.confidence !== undefined && data.confidence !== null) {
    const c = Number(data.confidence);
    if (isNaN(c) || c < 0 || c > 1) {
      errors.push("confidence must be between 0.0 and 1.0");
    }
  }

  return { valid: errors.length === 0, errors };
}
