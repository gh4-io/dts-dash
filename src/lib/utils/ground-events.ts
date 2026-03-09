import type { GroundEventMeta, GroundEventType } from "@/types";

export const GROUND_EVENTS: Record<GroundEventType, GroundEventMeta> = {
  AOG: {
    type: "AOG",
    label: "AOG",
    color: "#f59e0b",
    description: "Aircraft on Ground — unscheduled maintenance",
    marker: {
      mode: "symbol",
      shape: "diamond",
      fillColor: "#f59e0b",
      strokeColor: "#000000",
      size: 5,
    },
  },
  BTB: {
    type: "BTB",
    label: "BTB",
    color: "#10b981",
    description: "Back to Blocks — departure complete",
    marker: { mode: "text", label: "BTB", color: "#6aa84f", stroke: "#393a3f", fontSize: 7 },
  },
  Ferry: {
    type: "Ferry",
    label: "FER",
    color: "#6b7280",
    description: "Positioning / non-revenue flight",
    marker: { mode: "text", label: "FER", color: "#b00b69", stroke: "#393a3f", fontSize: 7 },
  },
  Maintenance: {
    type: "Maintenance",
    label: "MX",
    color: "#f59e0b",
    description: "Scheduled heavy maintenance",
    marker: { mode: "text", label: "MX", color: "#6a329f", stroke: "#393a3f", fontSize: 7 },
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
