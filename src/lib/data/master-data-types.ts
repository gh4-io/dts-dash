/**
 * Master Data Import Types
 */

export interface CustomerImportRecord {
  name: string;
  displayName?: string;
  color?: string;
  colorText?: string;
  country?: string;
  established?: string;
  groupParent?: string;
  baseAirport?: string;
  website?: string;
  mocPhone?: string;
  iataCode?: string;
  icaoCode?: string;
  source?: "imported" | "confirmed";
}

export interface AircraftImportRecord {
  registration: string;
  model: string; // Model code (e.g., "767-300(F)")
  operator: string; // Customer name (fuzzy matched)
  manufacturer?: string;
  engineType?: string;
  serialNumber?: string;
  lessor?: string;
  age?: string;
  category?: string;
  source?: "imported" | "confirmed";
}

export interface ValidationResult<T> {
  valid: boolean;
  data: T[];
  errors: string[];
  warnings: string[];
}

export interface ImportSummary {
  total: number;
  toAdd: number;
  toUpdate: number;
  conflicts: number;
  invalidOperators?: number;
}

export interface UpdateDetail<T> {
  existing: T;
  new: T;
  conflict: boolean; // True if overwriting "confirmed" source
}

export interface ValidationDetails<T> {
  add: T[];
  update: UpdateDetail<T>[];
  warnings: string[];
  errors: string[];
}

export interface CommitResult {
  success: boolean;
  logId: string;
  summary: {
    added: number;
    updated: number;
    skipped: number;
  };
  errors?: string[];
  warnings?: string[];
}
