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
