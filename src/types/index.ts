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

export type WpStatus = "New" | "Approved" | "Closed" | "Printed" | "Canceled";

export type MHSource = "workpackage" | "default" | "manual";

export type ConfidenceLevel = "exact" | "pattern" | "raw" | "fallback";

// ─── Raw SharePoint Input ───────────────────────────────────────────────────

export interface SharePointWorkPackage {
  // Always present
  GUID: string;
  Aircraft: {
    Title: string; // Registration e.g. "C-FOIJ"
    field_5?: string; // Aircraft type e.g. "777F", "767-300(F)" (if present in SharePoint)
    AircraftType?: string; // Alternative type field (rare)
  };
  Customer: string;
  Arrival: string;
  Departure: string;
  TotalMH: number | null;
  TotalGroundHours: string;
  Workpackage_x0020_Status: WpStatus;

  // Present in current exports
  Title?: string; // SharePoint Title e.g. "AALU/L-160126"
  CustomerReference?: string; // Customer reference
  Description?: string; // WP description
  FlightId?: string | null;
  ParentID?: string | null;

  // Present in some exports, absent in others
  ID?: number; // SharePoint ID (not always present)
  DocumentSetID?: number;
  AircraftId?: number;
  HasWorkpackage?: boolean;
  WorkpackageNo?: string | null;
  CalendarComments?: string | null;
  IsNotClosedOrCanceled?: "1" | "0";
  Modified?: string; // SharePoint last-modified timestamp
  Created?: string; // SharePoint created timestamp
  OData__UIVersionString?: string; // SharePoint version e.g. "17.0"
}

// ─── Normalized Work Package ────────────────────────────────────────────────

export interface WorkPackage {
  id: number; // Auto-increment DB ID
  guid: string; // SharePoint GUID
  aircraftReg: string;
  customer: string;
  flightId: string | null;
  arrival: Date;
  departure: Date;
  totalMH: number | null;
  groundHours: number;
  status: WpStatus;
  effectiveMH: number;
  mhSource: MHSource;
  manualMHOverride: number | null;
  inferredType: string; // canonical type name or raw type string (D-032)

  // Optional fields (present in some SP exports)
  title: string | null;
  description: string | null;
  customerReference: string | null;
  hasWorkpackage: boolean;
  workpackageNo: string | null;
  calendarComments: string | null;
  isActive: boolean;
  modified: Date | null;
  created: Date | null;
}

// ─── Filter State ───────────────────────────────────────────────────────────

export interface FilterState {
  start: string;
  end: string;
  timezone: string;
  operators: string[];
  aircraft: string[];
  types: string[]; // canonical type names or raw strings (D-032)
}

export interface FilterActions {
  setStart: (v: string) => void;
  setEnd: (v: string) => void;
  setTimezone: (v: string) => void;
  setOperators: (v: string[]) => void;
  setAircraft: (v: string[]) => void;
  setTypes: (v: string[]) => void;
  reset: () => void;
  hydrate: (params: Partial<FilterState>) => void;
  hydrateDefaults: (dateRange: string, tz: string) => void;
  hydrateFromPreferences: (prefs: {
    defaultDateRange: string | null;
    defaultStartOffset: number;
    defaultEndOffset: number;
    defaultTimezone: string;
  }) => void;
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

// ─── Capacity Modeling V2 (v0.3.0) ─────────────────────────────────────────

export interface CapacityShift {
  id: number;
  code: string; // DAY, SWING, NIGHT
  name: string;
  startHour: number;
  endHour: number;
  paidHours: number;
  minHeadcount: number;
  sortOrder: number;
  isActive: boolean;
}

export interface CapacityAssumptions {
  id: number;
  station: string;
  paidToAvailable: number;
  availableToProductive: number;
  defaultMhNoWp: number;
  nightProductivityFactor: number;
  demandCurve: "EVEN" | "WEIGHTED";
  arrivalWeight: number;
  departureWeight: number;
  allocationMode: "DISTRIBUTE";
  isActive: boolean;
  effectiveFrom: string | null;
  effectiveTo: string | null;
}

export interface HeadcountPlan {
  id: number;
  station: string;
  shiftId: number;
  headcount: number;
  effectiveFrom: string; // YYYY-MM-DD
  effectiveTo: string | null;
  dayOfWeek: number | null; // 0=Sun..6=Sat
  label: string | null;
  notes: string | null;
}

export interface HeadcountException {
  id: number;
  station: string;
  shiftId: number;
  exceptionDate: string; // YYYY-MM-DD
  headcountDelta: number;
  reason: string | null;
}

/** Slot: a (date, shift) pair for demand/capacity computation */
export interface ShiftSlot {
  date: string; // YYYY-MM-DD
  shiftCode: string;
  shiftId: number;
}

/** Per-shift capacity breakdown for a single date+shift */
export interface ShiftCapacityV2 {
  shiftCode: string;
  shiftName: string;
  effectiveHeadcount: number;
  paidMH: number;
  availableMH: number;
  productiveMH: number;
  hasExceptions: boolean;
  belowMinHeadcount: boolean;
}

/** Daily capacity with per-shift breakdown */
export interface DailyCapacityV2 {
  date: string;
  totalProductiveMH: number;
  totalPaidMH: number;
  byShift: ShiftCapacityV2[];
  hasExceptions: boolean;
}

/** Per-shift demand breakdown with WP attribution */
export interface ShiftDemandV2 {
  shiftCode: string;
  demandMH: number;
  wpContributions: Array<{
    wpId: number;
    aircraftReg: string;
    customer: string;
    allocatedMH: number;
    mhSource: string;
  }>;
}

/** Daily demand V2 with per-shift and per-customer breakdown */
export interface DailyDemandV2 {
  date: string;
  totalDemandMH: number;
  aircraftCount: number;
  byCustomer: Record<string, number>;
  byShift: ShiftDemandV2[];
}

/** Per-shift utilization for a single date+shift */
export interface ShiftUtilizationV2 {
  shiftCode: string;
  utilization: number | null; // null when productiveMH = 0
  gapMH: number;
  demandMH: number;
  productiveMH: number;
  noCoverage: boolean;
}

/** Daily utilization V2 with per-shift breakdown */
export interface DailyUtilizationV2 {
  date: string;
  utilizationPercent: number | null;
  totalDemandMH: number;
  totalProductiveMH: number;
  gapMH: number;
  overtimeFlag: boolean;
  criticalFlag: boolean;
  noCoverageDays: number; // count of shifts with 0 productive MH
  byShift: ShiftUtilizationV2[];
}

/** Summary statistics for the capacity overview response */
export interface CapacitySummary {
  avgUtilization: number | null;
  peakUtilization: number | null;
  totalDemandMH: number;
  totalCapacityMH: number;
  criticalDays: number;
  overtimeDays: number;
  worstDeficit: { date: string; shift: string; gapMH: number } | null;
  noCoverageDays: number;
}

/** Full response for GET /api/capacity/overview */
export interface CapacityOverviewResponse {
  demand: DailyDemandV2[];
  capacity: DailyCapacityV2[];
  utilization: DailyUtilizationV2[];
  summary: CapacitySummary;
  warnings: string[];
  shifts: CapacityShift[];
  assumptions: CapacityAssumptions;
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

export type DataSource = "inferred" | "imported" | "confirmed";

export interface Customer {
  id: number;
  name: string;
  displayName: string;
  color: string;
  colorText: string;
  isActive: boolean;
  sortOrder: number;

  // Extended metadata
  country: string | null;
  established: string | null;
  groupParent: string | null;
  baseAirport: string | null;
  website: string | null;
  mocPhone: string | null;
  iataCode: string | null;
  icaoCode: string | null;

  // SharePoint identifiers
  spId: number | null;
  guid: string | null; // SharePoint GUID — primary dedup key when present

  // Source tracking
  source: DataSource;

  // Audit
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
}

// ─── User & Auth ────────────────────────────────────────────────────────────

export interface User {
  id: number;
  authId: string;
  email: string;
  username: string | null;
  displayName: string;
  role: UserRole;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface UserPreferences {
  userId: number;
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
  id: number;
  pattern: string;
  canonicalType: AircraftType;
  description: string | null;
  priority: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface NormalizedAircraftType {
  canonical: string; // canonical name if mapped, raw string if unmatched, "Unknown" if no data (D-032)
  raw: string;
  confidence: ConfidenceLevel;
  mappingId: number | null;
}

// ─── Import Log ─────────────────────────────────────────────────────────────

export interface ImportLog {
  id: number;
  importedAt: string;
  recordCount: number;
  source: "file" | "paste" | "api";
  fileName: string | null;
  importedBy: number;
  status: "success" | "partial" | "failed";
  errors: string | null;
}

// ─── Analytics Event ────────────────────────────────────────────────────────

export interface AnalyticsEvent {
  id: number;
  userId: number;
  eventType: string;
  eventData: string | null;
  page: string | null;
  createdAt: string;
}

// ─── Allowed Hostnames ──────────────────────────────────────────────────────

export interface AllowedHostname {
  id: string;
  hostname: string;
  port: number | null;
  protocol: "http" | "https";
  enabled: boolean;
  label: string;
}

// ─── App Config ─────────────────────────────────────────────────────────────

export interface AppConfig {
  defaultMH: number;
  wpMHMode: "include" | "exclude";
  theoreticalCapacityPerPerson: number;
  realCapacityPerPerson: number;
  shifts: ShiftDefinition[];
  ingestApiKey: string;
  ingestRateLimitSeconds: number;
  ingestMaxSizeMB: number;
  masterDataConformityMode: "strict" | "warning" | "auto-add";
  masterDataOverwriteConfirmed: "allow" | "warn" | "reject";
  allowedHostnames: AllowedHostname[];
}

// ─── Master Data: Manufacturers ─────────────────────────────────────────────

export interface Manufacturer {
  id: number;
  name: string;
  sortOrder: number;
  isActive: boolean;
}

// ─── Master Data: Aircraft Models ───────────────────────────────────────────

export interface AircraftModel {
  id: number;
  modelCode: string;
  canonicalType: string;
  manufacturerId: number | null;
  displayName: string;
  sortOrder: number;
  isActive: boolean;
}

// ─── Master Data: Engine Types ──────────────────────────────────────────────

export interface EngineType {
  id: number;
  name: string;
  manufacturer: string | null;
  sortOrder: number;
  isActive: boolean;
}

// ─── Master Data: Aircraft ──────────────────────────────────────────────────

export interface Aircraft {
  id: number;
  registration: string;
  // SharePoint identifiers
  spId: number | null;
  guid: string | null; // SharePoint GUID — primary dedup key when present
  // Direct type from ac.json field_5 — truth source for type resolution
  aircraftType: string | null;
  aircraftModelId: number | null;
  operatorId: number | null;
  manufacturerId: number | null;
  engineTypeId: number | null;
  serialNumber: string | null;
  age: string | null;
  lessor: string | null;
  category: string | null;
  operatorRaw: string | null;
  operatorMatchConfidence: number | null;
  source: DataSource;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  createdBy: number | null;
  updatedBy: number | null;
}

// ─── Master Data Import Log ─────────────────────────────────────────────────

export interface MasterDataImportLog {
  id: number;
  importedAt: string;
  dataType: "customer" | "aircraft";
  source: "file" | "paste" | "api";
  format: "csv" | "json";
  fileName: string | null;
  recordsTotal: number;
  recordsAdded: number;
  recordsUpdated: number;
  recordsSkipped: number;
  importedBy: number;
  status: "success" | "partial" | "failed";
  warnings: string | null;
  errors: string | null;
}
