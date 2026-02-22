/**
 * Allocation Data Access Layer — Demand Contracts + Lines
 *
 * Drizzle queries for demand contracts CRUD with transactional line management.
 * Follows capacity-data.ts patterns.
 */

import { db } from "@/lib/db/client";
import { eq, and, lte, gte, or, isNull } from "drizzle-orm";
import { demandContracts, demandAllocationLines, customers } from "@/lib/db/schema";
import type { DemandContract, DemandAllocationLine } from "@/types";
import { computeContractProjection, getProjectionStatus } from "./allocation-engine";

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load demand contracts with embedded lines, optionally filtered by date range.
 * Includes computed projection and status for each contract.
 */
export function loadDemandContracts(
  startDate?: string,
  endDate?: string,
  activeOnly?: boolean,
): DemandContract[] {
  const conditions = [];

  if (activeOnly) {
    conditions.push(eq(demandContracts.isActive, true));
  }

  if (startDate && endDate) {
    conditions.push(lte(demandContracts.effectiveFrom, endDate));
    conditions.push(
      or(isNull(demandContracts.effectiveTo), gte(demandContracts.effectiveTo, startDate)),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const contractRows = where
    ? db.select().from(demandContracts).where(where).all()
    : db.select().from(demandContracts).all();

  // Load all lines for these contracts in one query
  const contractIds = contractRows.map((c) => c.id);
  const allLines = contractIds.length > 0 ? db.select().from(demandAllocationLines).all() : [];

  // Group lines by contract
  const linesByContract = new Map<number, typeof allLines>();
  for (const line of allLines) {
    if (!contractIds.includes(line.contractId)) continue;
    const list = linesByContract.get(line.contractId) ?? [];
    list.push(line);
    linesByContract.set(line.contractId, list);
  }

  // Load customer names
  const customerRows = db.select({ id: customers.id, name: customers.name }).from(customers).all();
  const customerNameMap = new Map(customerRows.map((c) => [c.id, c.name]));

  return contractRows.map((r) => {
    const lines = (linesByContract.get(r.id) ?? []).map(toLineDTO);
    const contract = toContractDTO(r, customerNameMap, lines);
    const projectedMh = computeContractProjection(contract, lines);
    const projectionStatus = getProjectionStatus(projectedMh, contract.contractedMh);
    return { ...contract, projectedMh, projectionStatus };
  });
}

/**
 * Load a single demand contract by ID with its lines.
 */
export function loadDemandContract(id: number): DemandContract | null {
  const row = db.select().from(demandContracts).where(eq(demandContracts.id, id)).get();
  if (!row) return null;

  const lineRows = db
    .select()
    .from(demandAllocationLines)
    .where(eq(demandAllocationLines.contractId, id))
    .all();

  const custRow = db
    .select({ name: customers.name })
    .from(customers)
    .where(eq(customers.id, row.customerId))
    .get();

  const lines = lineRows.map(toLineDTO);
  const contract: DemandContract = {
    id: row.id,
    customerId: row.customerId,
    customerName: custRow?.name ?? undefined,
    name: row.name,
    mode: row.mode as DemandContract["mode"],
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    contractedMh: row.contractedMh,
    periodType: row.periodType as DemandContract["periodType"],
    reason: row.reason,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines,
  };
  contract.projectedMh = computeContractProjection(contract, lines);
  contract.projectionStatus = getProjectionStatus(contract.projectedMh!, contract.contractedMh);
  return contract;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createDemandContract(data: {
  customerId: number;
  name: string;
  mode: string;
  effectiveFrom: string;
  effectiveTo?: string | null;
  contractedMh?: number | null;
  periodType?: string | null;
  reason?: string | null;
  isActive: boolean;
  createdBy?: number | null;
  lines: {
    shiftId?: number | null;
    dayOfWeek?: number | null;
    allocatedMh: number;
    label?: string | null;
  }[];
}): DemandContract {
  const now = new Date().toISOString();

  // Transaction: create contract + bulk-insert lines
  const result = db.transaction((tx) => {
    const contractRow = tx
      .insert(demandContracts)
      .values({
        customerId: data.customerId,
        name: data.name,
        mode: data.mode,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo ?? null,
        contractedMh: data.contractedMh ?? null,
        periodType: data.periodType ?? null,
        reason: data.reason ?? null,
        isActive: data.isActive,
        createdBy: data.createdBy ?? null,
        createdAt: now,
        updatedAt: now,
      })
      .returning()
      .get();

    const lineRows = data.lines.map((line) =>
      tx
        .insert(demandAllocationLines)
        .values({
          contractId: contractRow.id,
          shiftId: line.shiftId ?? null,
          dayOfWeek: line.dayOfWeek ?? null,
          allocatedMh: line.allocatedMh,
          label: line.label ?? null,
        })
        .returning()
        .get(),
    );

    return { contractRow, lineRows };
  });

  return loadDemandContract(result.contractRow.id)!;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateDemandContract(
  id: number,
  data: {
    customerId?: number;
    name?: string;
    mode?: string;
    effectiveFrom?: string;
    effectiveTo?: string | null;
    contractedMh?: number | null;
    periodType?: string | null;
    reason?: string | null;
    isActive?: boolean;
    lines?: {
      shiftId?: number | null;
      dayOfWeek?: number | null;
      allocatedMh: number;
      label?: string | null;
    }[];
  },
): DemandContract | null {
  const existing = db.select().from(demandContracts).where(eq(demandContracts.id, id)).get();
  if (!existing) return null;

  db.transaction((tx) => {
    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

    if (data.customerId !== undefined) updates.customerId = data.customerId;
    if (data.name !== undefined) updates.name = data.name;
    if (data.mode !== undefined) updates.mode = data.mode;
    if (data.effectiveFrom !== undefined) updates.effectiveFrom = data.effectiveFrom;
    if (data.effectiveTo !== undefined) updates.effectiveTo = data.effectiveTo;
    if (data.contractedMh !== undefined) updates.contractedMh = data.contractedMh;
    if (data.periodType !== undefined) updates.periodType = data.periodType;
    if (data.reason !== undefined) updates.reason = data.reason;
    if (data.isActive !== undefined) updates.isActive = data.isActive;

    tx.update(demandContracts).set(updates).where(eq(demandContracts.id, id)).run();

    // If lines provided, replace all (delete existing, insert new)
    if (data.lines !== undefined) {
      tx.delete(demandAllocationLines).where(eq(demandAllocationLines.contractId, id)).run();

      for (const line of data.lines) {
        tx.insert(demandAllocationLines)
          .values({
            contractId: id,
            shiftId: line.shiftId ?? null,
            dayOfWeek: line.dayOfWeek ?? null,
            allocatedMh: line.allocatedMh,
            label: line.label ?? null,
          })
          .run();
      }
    }
  });

  return loadDemandContract(id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteDemandContract(id: number): boolean {
  const existing = db.select().from(demandContracts).where(eq(demandContracts.id, id)).get();
  if (!existing) return false;
  // CASCADE deletes lines automatically
  db.delete(demandContracts).where(eq(demandContracts.id, id)).run();
  return true;
}

// ─── Customer Name Map ────────────────────────────────────────────────────────

export function loadCustomerNameMap(): Map<number, string> {
  const rows = db.select({ id: customers.id, name: customers.name }).from(customers).all();
  return new Map(rows.map((r) => [r.id, r.name]));
}

// ─── DTO Helpers ──────────────────────────────────────────────────────────────

function toContractDTO(
  row: typeof demandContracts.$inferSelect,
  customerNameMap: Map<number, string>,
  lines: DemandAllocationLine[],
): DemandContract {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: customerNameMap.get(row.customerId) ?? undefined,
    name: row.name,
    mode: row.mode as DemandContract["mode"],
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    contractedMh: row.contractedMh,
    periodType: row.periodType as DemandContract["periodType"],
    reason: row.reason,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
    lines,
  };
}

function toLineDTO(row: typeof demandAllocationLines.$inferSelect): DemandAllocationLine {
  return {
    id: row.id,
    contractId: row.contractId,
    shiftId: row.shiftId,
    dayOfWeek: row.dayOfWeek,
    allocatedMh: row.allocatedMh,
    label: row.label,
  };
}
