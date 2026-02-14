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
