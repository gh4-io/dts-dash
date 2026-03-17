import type { GroundEventMeta, GroundEventType } from "@/types";

export const GROUND_EVENTS: Record<GroundEventType, GroundEventMeta> = {
  AOG: {
    type: "AOG",
    label: "AOG",
    color: "#b91c1c",
    description: "Aircraft on Ground — unscheduled maintenance",
    marker: { mode: "symbol", shape: "diamond", fill: "#b91c1c", stroke: "#450a0a" },
  },
  BTB: {
    type: "BTB",
    label: "BTB",
    color: "#047857",
    description: "Back to Blocks — departure complete",
    marker: {
      mode: "pill",
      label: "BTB",
      fill: "#047857",
      stroke: "#022c22",
      textColor: "#ffffff",
    },
  },
  Ferry: {
    type: "Ferry",
    label: "FER",
    color: "#334155",
    description: "Positioning / non-revenue flight",
    marker: {
      mode: "pill",
      label: "FER",
      fill: "#334155",
      stroke: "#0f172a",
      textColor: "#e2e8f0",
    },
  },
  Maintenance: {
    type: "Maintenance",
    label: "MX",
    color: "#b45309",
    description: "Scheduled heavy maintenance",
    marker: { mode: "pill", label: "MX", fill: "#b45309", stroke: "#451a03", textColor: "#ffffff" },
  },
};

export const GROUND_EVENT_TYPES = Object.keys(GROUND_EVENTS) as GroundEventType[];

export function isGroundEventType(v: string): v is GroundEventType {
  return v in GROUND_EVENTS;
}

/** Parse JSON array from DB column, validate each entry */
export function parseGroundEventTypes(raw: string | null | undefined): GroundEventType[] {
  if (!raw) return [];
  try {
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr.filter(isGroundEventType);
  } catch {
    return [];
  }
}
