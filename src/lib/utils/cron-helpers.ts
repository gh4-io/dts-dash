/**
 * Cron expression utilities — human-readable text, validation, preset builder.
 * Client-safe (no server-only imports).
 */

// ─── Validation ──────────────────────────────────────────────────────────────

const CRON_FIELD_RANGES: [number, number][] = [
  [0, 59], // minute
  [0, 23], // hour
  [1, 31], // day of month
  [1, 12], // month
  [0, 7], // day of week (0 and 7 = Sunday)
];

function isValidField(field: string, min: number, max: number): boolean {
  if (field === "*") return true;

  // Handle step: */n or range/n
  const stepParts = field.split("/");
  if (stepParts.length > 2) return false;

  const base = stepParts[0];
  const step = stepParts[1];

  if (step !== undefined) {
    const stepNum = Number(step);
    if (!Number.isInteger(stepNum) || stepNum < 1) return false;
  }

  if (base === "*") return true;

  // Handle comma-separated lists
  const parts = base.split(",");
  for (const part of parts) {
    // Handle range: n-m
    if (part.includes("-")) {
      const [lo, hi] = part.split("-").map(Number);
      if (!Number.isInteger(lo) || !Number.isInteger(hi)) return false;
      if (lo < min || hi > max || lo > hi) return false;
    } else {
      const num = Number(part);
      if (!Number.isInteger(num) || num < min || num > max) return false;
    }
  }

  return true;
}

/** Validate a 5-field cron expression. Returns error message or null if valid. */
export function validateCronExpression(expression: string): string | null {
  if (!expression || typeof expression !== "string") {
    return "Expression is required";
  }

  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) {
    return "Must have exactly 5 fields (minute hour dom month dow)";
  }

  const fieldNames = ["Minute", "Hour", "Day of month", "Month", "Day of week"];
  for (let i = 0; i < 5; i++) {
    const [min, max] = CRON_FIELD_RANGES[i];
    if (!isValidField(fields[i], min, max)) {
      return `Invalid ${fieldNames[i]} field: "${fields[i]}"`;
    }
  }

  return null;
}

// ─── Human-readable ──────────────────────────────────────────────────────────

function ordinal(n: number): string {
  const s = ["th", "st", "nd", "rd"];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

const DOW_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function formatTime(hour: string, minute: string): string {
  const h = Number(hour);
  const m = Number(minute);
  const mm = m.toString().padStart(2, "0");
  if (h === 0) return `12:${mm} AM`;
  if (h < 12) return `${h}:${mm} AM`;
  if (h === 12) return `12:${mm} PM`;
  return `${h - 12}:${mm} PM`;
}

/** Convert a 5-field cron expression to human-readable text */
export function cronToHuman(expression: string): string {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5) return expression;

  const [minute, hour, dom, month, dow] = fields;

  // Every N minutes: */N * * * *
  if (hour === "*" && dom === "*" && month === "*" && dow === "*") {
    if (minute.startsWith("*/")) {
      const interval = Number(minute.slice(2));
      if (interval === 1) return "Every minute";
      return `Every ${interval} minutes`;
    }
    if (minute === "*") return "Every minute";
  }

  // Every N hours: M */N * * *
  if (dom === "*" && month === "*" && dow === "*" && hour.startsWith("*/")) {
    const interval = Number(hour.slice(2));
    const min = minute === "0" ? ":00" : `:${minute.padStart(2, "0")}`;
    if (interval === 1) return `Every hour at ${min}`;
    return `Every ${interval} hours at ${min}`;
  }

  // Specific hour(s) every day: M H * * *
  if (dom === "*" && month === "*" && dow === "*" && !hour.includes("*") && !hour.includes("/")) {
    if (hour.includes(",")) {
      const hours = hour.split(",").map((h) => formatTime(h, minute));
      return `Daily at ${hours.join(", ")}`;
    }
    return `Daily at ${formatTime(hour, minute)}`;
  }

  // Weekly: M H * * DOW
  if (dom === "*" && month === "*" && dow !== "*" && !dow.includes("*")) {
    const days = dow.split(",").map((d) => DOW_NAMES[Number(d) % 7] || d);
    return `${days.join(", ")} at ${formatTime(hour, minute)}`;
  }

  // Monthly: M H DOM * *
  if (dom !== "*" && !dom.includes("*") && month === "*" && dow === "*") {
    return `${ordinal(Number(dom))} of every month at ${formatTime(hour, minute)}`;
  }

  // Fallback
  return expression;
}

// ─── Next Run Calculation ────────────────────────────────────────────────────

/**
 * Expand a single cron field into the set of values it matches.
 * Returns null if the field cannot be parsed (caller should treat as no match).
 */
function expandField(field: string, min: number, max: number): Set<number> | null {
  const out = new Set<number>();

  for (const chunk of field.split(",")) {
    const [base, stepRaw] = chunk.split("/");
    const step = stepRaw === undefined ? 1 : Number(stepRaw);
    if (!Number.isInteger(step) || step < 1) return null;

    let lo: number;
    let hi: number;

    if (base === "*") {
      lo = min;
      hi = max;
    } else if (base.includes("-")) {
      const [a, b] = base.split("-").map(Number);
      if (!Number.isInteger(a) || !Number.isInteger(b)) return null;
      lo = a;
      hi = b;
    } else {
      const n = Number(base);
      if (!Number.isInteger(n)) return null;
      lo = n;
      // A bare value with a step (e.g. 5/10) runs from that value to the max
      hi = stepRaw === undefined ? n : max;
    }

    if (lo < min || hi > max || lo > hi) return null;
    for (let v = lo; v <= hi; v += step) out.add(v);
  }

  return out.size > 0 ? out : null;
}

/** Day-of-week is 0-7 in cron with both 0 and 7 meaning Sunday — normalize to 0-6. */
function normalizeDow(values: Set<number>): Set<number> {
  const out = new Set<number>();
  for (const v of values) out.add(v % 7);
  return out;
}

/**
 * Compute the next fire time for a 5-field cron expression, searching forward
 * from `from` (exclusive). Evaluated in the server's local timezone, matching
 * node-cron's default behaviour.
 *
 * Returns null for an invalid expression, or if no match exists within a year
 * (e.g. `0 0 30 2 *` — 30 February).
 */
export function nextCronRun(expression: string, from: Date = new Date()): Date | null {
  if (validateCronExpression(expression) !== null) return null;

  const [minF, hourF, domF, monthF, dowF] = expression.trim().split(/\s+/);
  const minutes = expandField(minF, 0, 59);
  const hours = expandField(hourF, 0, 23);
  const doms = expandField(domF, 1, 31);
  const months = expandField(monthF, 1, 12);
  const dowsRaw = expandField(dowF, 0, 7);
  if (!minutes || !hours || !doms || !months || !dowsRaw) return null;
  const dows = normalizeDow(dowsRaw);

  // Standard cron: when BOTH day-of-month and day-of-week are restricted the
  // job fires when either matches; when only one is restricted, only it applies.
  const domRestricted = domF !== "*";
  const dowRestricted = dowF !== "*";

  const cursor = new Date(from.getTime());
  cursor.setSeconds(0, 0);
  cursor.setMinutes(cursor.getMinutes() + 1);

  // 366 days covers every expression that can ever fire, including 29 February.
  const limit = new Date(cursor.getTime() + 367 * 24 * 60 * 60 * 1000);

  while (cursor < limit) {
    if (!months.has(cursor.getMonth() + 1)) {
      // Jump to the 1st of the next month
      cursor.setMonth(cursor.getMonth() + 1, 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    const domMatch = doms.has(cursor.getDate());
    const dowMatch = dows.has(cursor.getDay());
    const dayMatch =
      domRestricted && dowRestricted ? domMatch || dowMatch : domRestricted ? domMatch : dowMatch;

    if (!dayMatch) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(0, 0, 0, 0);
      continue;
    }

    if (!hours.has(cursor.getHours())) {
      cursor.setHours(cursor.getHours() + 1, 0, 0, 0);
      continue;
    }

    if (!minutes.has(cursor.getMinutes())) {
      cursor.setMinutes(cursor.getMinutes() + 1, 0, 0);
      continue;
    }

    return new Date(cursor.getTime());
  }

  return null;
}

/**
 * Approximate the interval between consecutive fires, in milliseconds, by
 * measuring the gap between the next two runs. Used to judge whether a
 * scheduled job (notably the database backup) is overdue.
 */
export function cronIntervalMs(expression: string, from: Date = new Date()): number | null {
  const first = nextCronRun(expression, from);
  if (!first) return null;
  const second = nextCronRun(expression, first);
  if (!second) return null;
  return second.getTime() - first.getTime();
}

// ─── Preset Builder ──────────────────────────────────────────────────────────

export type CronPresetFrequency = "minutes" | "hours" | "daily" | "weekly" | "monthly";

export interface CronPreset {
  frequency: CronPresetFrequency;
  interval?: number; // for minutes/hours
  minute?: number; // minute offset (0-59)
  hour?: number; // for daily/weekly/monthly
  daysOfWeek?: number[]; // 0-6 for weekly
  dayOfMonth?: number; // 1-28 for monthly
}

/** Build a cron expression from a structured preset */
export function buildCronExpression(preset: CronPreset): string {
  const min = preset.minute ?? 0;

  switch (preset.frequency) {
    case "minutes": {
      const interval = preset.interval ?? 5;
      return `*/${interval} * * * *`;
    }
    case "hours": {
      const interval = preset.interval ?? 1;
      return `${min} */${interval} * * *`;
    }
    case "daily": {
      const hour = preset.hour ?? 0;
      return `${min} ${hour} * * *`;
    }
    case "weekly": {
      const hour = preset.hour ?? 0;
      const days = preset.daysOfWeek?.length ? preset.daysOfWeek.join(",") : "1";
      return `${min} ${hour} * * ${days}`;
    }
    case "monthly": {
      const hour = preset.hour ?? 0;
      const dom = preset.dayOfMonth ?? 1;
      return `${min} ${hour} ${dom} * *`;
    }
    default:
      return "0 0 * * *";
  }
}
