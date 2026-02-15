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
  // ─── Exact type string matches (highest priority) ───
  { pattern: "B777", canonicalType: "B777" as const, description: "Exact B777", priority: 100 },
  { pattern: "B767", canonicalType: "B767" as const, description: "Exact B767", priority: 100 },
  { pattern: "B747", canonicalType: "B747" as const, description: "Exact B747", priority: 100 },
  { pattern: "B757", canonicalType: "B757" as const, description: "Exact B757", priority: 100 },
  { pattern: "B737", canonicalType: "B737" as const, description: "Exact B737", priority: 100 },

  // ─── Registration-based patterns (medium-high priority) ───
  // CargoJet Airways fleet (C-F*, C-G* prefixes) — B767 freighters
  { pattern: "C-F*", canonicalType: "B767" as const, description: "CargoJet C-F* registration → B767", priority: 80 },
  { pattern: "C-G*", canonicalType: "B767" as const, description: "CargoJet C-G* registration → B767", priority: 80 },

  // Aerologic fleet (D-AA*, D-AER* prefix) — B777F freighters
  { pattern: "D-AA*", canonicalType: "B777" as const, description: "Aerologic D-AA* registration → B777F", priority: 80 },
  { pattern: "D-AER*", canonicalType: "B777" as const, description: "Aerologic D-AER* registration → B777F", priority: 80 },

  // DHL Air UK fleet (G-DHL*, G-DHM* prefix) — mix of B757/B767 freighters
  { pattern: "G-DHL*", canonicalType: "B767" as const, description: "DHL Air UK G-DHL* registration → B767 (default)", priority: 80 },
  { pattern: "G-DHM*", canonicalType: "B767" as const, description: "DHL Air UK G-DHM* registration → B767 (default)", priority: 80 },

  // Kalitta Air fleet (N7* prefixes) — B747/B767/B777
  { pattern: "N77?CK", canonicalType: "B777" as const, description: "Kalitta N77xCK → B777", priority: 85 },
  { pattern: "N76?CK", canonicalType: "B767" as const, description: "Kalitta N76xCK → B767", priority: 85 },
  { pattern: "N74?CK", canonicalType: "B747" as const, description: "Kalitta N74xCK → B747", priority: 85 },
  { pattern: "N79?CK", canonicalType: "B747" as const, description: "Kalitta N79xCK → B747", priority: 85 },
  { pattern: "N78?CK", canonicalType: "B747" as const, description: "Kalitta N78xCK → B747", priority: 85 },

  // Kalitta Charters/21 Air (N2*, N3*, N4* catch-all)
  { pattern: "N2*", canonicalType: "B767" as const, description: "Kalitta N2* → B767 (default)", priority: 70 },
  { pattern: "N3*", canonicalType: "B767" as const, description: "Kalitta N3* → B767 (default)", priority: 70 },
  { pattern: "N4*", canonicalType: "B767" as const, description: "Kalitta N4* → B767 (default)", priority: 70 },

  // ─── Type string substring matches (lower priority) ───
  { pattern: "*777*", canonicalType: "B777" as const, description: "Contains 777", priority: 50 },
  { pattern: "*767*", canonicalType: "B767" as const, description: "Contains 767", priority: 50 },
  { pattern: "*747*", canonicalType: "B747" as const, description: "Contains 747 (incl 747-4R7F, 747F)", priority: 50 },
  { pattern: "*757*", canonicalType: "B757" as const, description: "Contains 757", priority: 50 },
  { pattern: "*737*", canonicalType: "B737" as const, description: "Contains 737 (incl 737-200)", priority: 50 },
] as const;
