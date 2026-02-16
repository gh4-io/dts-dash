// ─── Domain Enums & Literals ────────────────────────────────────────────────

export type CustomerName =
  | "CargoJet Airways"
  | "Aerologic"
  | "Kalitta Air"
  | "DHL Air UK"
  | "Kalitta Charters II"
  | "21 Air";

export type AircraftType = "B777" | "B767" | "B747" | "B757" | "B737" | "Unknown";

export type UserRole = "user" | "admin" | "superadmin";

export type ColorMode = "light" | "dark" | "system";

export type ThemePreset =
  | "neutral"
  | "ocean"
  | "purple"
  | "black"
  | "vitepress"
  | "dusk"
  | "catppuccin"
  | "solar"
  | "emerald"
  | "ruby"
  | "aspen";

export type DateRange = "1d" | "3d" | "1w";

export type TimeFormat = "12h" | "24h";

export type WpStatus = "New" | "Approved";

export type MHSource = "workpackage" | "default" | "manual";

export type ConfidenceLevel = "exact" | "pattern" | "fallback";

// ─── Raw SharePoint Input ───────────────────────────────────────────────────

export interface SharePointWorkPackage {
  ID: number;
  DocumentSetID: number;
  Aircraft: {
    Title: string;              // Registration e.g. "C-FOIJ"
    field_5?: string;            // Aircraft type e.g. "777F", "767-300(F)" (if present in SharePoint)
    AircraftType?: string;       // Alternative type field (rare)
  };
  AircraftId: number;
  Customer: string;
  FlightId: string | null;
  Arrival: string;
  Departure: string;
  TotalMH: number | null;
  TotalGroundHours: string;
  Workpackage_x0020_Status: WpStatus;
  HasWorkpackage: boolean;
  WorkpackageNo: string | null;
  CalendarComments: string | null;
  IsNotClosedOrCanceled: "1" | "0";
  Modified: string;
  Created: string;
}

// ─── Normalized Work Package ────────────────────────────────────────────────

export interface WorkPackage {
  id: number;
  documentSetId: number;
  aircraftReg: string;
  aircraftId: number;
  customer: string;
  flightId: string | null;
  arrival: Date;
  departure: Date;
  totalMH: number | null;
  groundHours: number;
  status: WpStatus;
  hasWorkpackage: boolean;
  workpackageNo: string | null;
  calendarComments: string | null;
  isActive: boolean;
  modified: Date;
  created: Date;
  effectiveMH: number;
  mhSource: MHSource;
  manualMHOverride: number | null;
  inferredType: AircraftType;
}

// ─── Filter State ───────────────────────────────────────────────────────────

export interface FilterState {
  start: string;
  end: string;
  timezone: string;
  operators: string[];
  aircraft: string[];
  types: AircraftType[];
}

export interface FilterActions {
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
  setTimezone: (v: string) => void;
  setOperators: (v: string[]) => void;
  setAircraft: (v: string[]) => void;
  setTypes: (v: AircraftType[]) => void;
  reset: () => void;
  hydrate: (params: Partial<FilterState>) => void;
  hydrateDefaults: (dateRange: string, tz: string) => void;
}

// ─── Capacity & Analytics ───────────────────────────────────────────────────

export interface ShiftDefinition {
  name: string;
  startHour: number;
  endHour: number;
  headcount: number;
}

export interface DailyDemand {
  date: string;
  totalDemandMH: number;
  aircraftCount: number;
  byCustomer: Record<string, number>;
}

export interface DailyCapacity {
  date: string;
  theoreticalCapacityMH: number;
  realCapacityMH: number;
  byShift: ShiftCapacity[];
}

export interface ShiftCapacity {
  shift: string;
  headcount: number;
  theoreticalMH: number;
  realMH: number;
}

export interface DailyUtilization {
  date: string;
  utilizationPercent: number;
  surplusDeficitMH: number;
  overtimeFlag: boolean;
  criticalFlag: boolean;
}

export interface HourlySnapshot {
  hour: string;
  arrivalsCount: number;
  departuresCount: number;
  onGroundCount: number;
}

// ─── Pagination (D-017) ────────────────────────────────────────────────────

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

// ─── Customer ───────────────────────────────────────────────────────────────

export interface Customer {
  id: string;
  name: string;
  displayName: string;
  color: string;
  colorText: string;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

// ─── User & Auth ────────────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: string;
  colorMode: ColorMode;
  themePreset: ThemePreset;
  accentColor: string | null;
  compactMode: boolean;
  defaultTimezone: string;
  defaultDateRange: DateRange;
  timeFormat: TimeFormat;
  tablePageSize: number;
}

// ─── Aircraft Type Mapping (D-015) ──────────────────────────────────────────

export interface AircraftTypeMapping {
  id: string;
  pattern: string;
  canonicalType: AircraftType;
  description: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedAircraftType {
  canonical: AircraftType;
  raw: string;
  confidence: ConfidenceLevel;
  mappingId: string | null;
}

// ─── Import Log ─────────────────────────────────────────────────────────────

export interface ImportLog {
  id: string;
  importedAt: string;
  recordCount: number;
  source: "file" | "paste" | "api";
  fileName: string | null;
  importedBy: string;
  status: "success" | "partial" | "failed";
  errors: string | null;
}

// ─── Analytics Event ────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: string;
  userId: string;
  eventType: string;
  eventData: string | null;
  page: string | null;
  createdAt: string;
}

// ─── App Config ─────────────────────────────────────────────────────────────

export interface AppConfig {
  defaultMH: number;
  wpMHMode: "include" | "exclude";
  theoreticalCapacityPerPerson: number;
  realCapacityPerPerson: number;
  shifts: ShiftDefinition[];
  timelineDefaultDays: number;
  defaultTimezone: string;
  ingestApiKey: string;
  ingestRateLimitSeconds: number;
  ingestMaxSizeMB: number;
}
