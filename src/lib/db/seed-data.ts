/**
 * Shared seed data constants — used by seed.ts and reset-defaults API.
 */

export const SEED_CUSTOMERS = [
  { name: "CargoJet Airways", displayName: "CargoJet", color: "#22c55e", colorText: "#ffffff", sortOrder: 1 },
  { name: "Aerologic", displayName: "Aerologic", color: "#8b5cf6", colorText: "#ffffff", sortOrder: 2 },
  { name: "Kalitta Air", displayName: "Kalitta Air", color: "#f97316", colorText: "#ffffff", sortOrder: 3 },
  { name: "DHL Air UK", displayName: "DHL Air UK", color: "#ef4444", colorText: "#ffffff", sortOrder: 4 },
  { name: "Kalitta Charters II", displayName: "Kalitta Chrt II", color: "#06b6d4", colorText: "#ffffff", sortOrder: 5 },
  { name: "21 Air", displayName: "21 Air", color: "#ec4899", colorText: "#ffffff", sortOrder: 6 },
] as const;

export const SEED_AIRCRAFT_TYPE_MAPPINGS = [
  // Exact matches (highest priority)
  { pattern: "^B777$", canonicalType: "B777" as const, description: "Exact B777", priority: 100 },
  { pattern: "^B767$", canonicalType: "B767" as const, description: "Exact B767", priority: 100 },
  { pattern: "^B747$", canonicalType: "B747" as const, description: "Exact B747", priority: 100 },
  { pattern: "^B757$", canonicalType: "B757" as const, description: "Exact B757", priority: 100 },
  { pattern: "^B737$", canonicalType: "B737" as const, description: "Exact B737", priority: 100 },
  // Pattern matches (lower priority)
  { pattern: "777", canonicalType: "B777" as const, description: "Contains 777", priority: 50 },
  { pattern: "767", canonicalType: "B767" as const, description: "Contains 767", priority: 50 },
  { pattern: "747", canonicalType: "B747" as const, description: "Contains 747 (incl 747-4R7F, 747F)", priority: 50 },
  { pattern: "757", canonicalType: "B757" as const, description: "Contains 757", priority: 50 },
  { pattern: "737", canonicalType: "B737" as const, description: "Contains 737 (incl 737-200)", priority: 50 },
] as const;
