/**
 * Allocation Data Access Layer (P2-6)
 *
 * Drizzle queries for demand allocations CRUD.
 * Follows capacity-data.ts patterns.
 */

import { db } from "@/lib/db/client";
import { eq, and, lte, gte, or, isNull } from "drizzle-orm";
import { demandAllocations, customers } from "@/lib/db/schema";
import type { DemandAllocation } from "@/types";

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load demand allocations, optionally filtered by date range overlap.
 * Joins customer name for display.
 */
export function loadDemandAllocations(
  startDate?: string,
  endDate?: string,
  activeOnly?: boolean,
): DemandAllocation[] {
  const conditions = [];

  if (activeOnly) {
    conditions.push(eq(demandAllocations.isActive, true));
  }

  if (startDate && endDate) {
    // Overlap: effectiveFrom <= endDate AND (effectiveTo IS NULL OR effectiveTo >= startDate)
    conditions.push(lte(demandAllocations.effectiveFrom, endDate));
    conditions.push(
      or(isNull(demandAllocations.effectiveTo), gte(demandAllocations.effectiveTo, startDate)),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = where
    ? db.select().from(demandAllocations).where(where).all()
    : db.select().from(demandAllocations).all();

  // Load customer names in one query
  const customerRows = db.select({ id: customers.id, name: customers.name }).from(customers).all();
  const customerNameMap = new Map(customerRows.map((c) => [c.id, c.name]));

  return rows.map((r) => toDTO(r, customerNameMap));
}

/**
 * Load a single demand allocation by ID.
 */
export function loadDemandAllocation(id: number): DemandAllocation | null {
  const row = db.select().from(demandAllocations).where(eq(demandAllocations.id, id)).get();
  if (!row) return null;

  const custRow = db
    .select({ name: customers.name })
    .from(customers)
    .where(eq(customers.id, row.customerId))
    .get();

  return {
    id: row.id,
    customerId: row.customerId,
    customerName: custRow?.name ?? undefined,
    shiftId: row.shiftId,
    dayOfWeek: row.dayOfWeek,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    allocatedMh: row.allocatedMh,
    mode: row.mode as DemandAllocation["mode"],
    reason: row.reason,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createDemandAllocation(
  data: Omit<DemandAllocation, "id" | "customerName" | "createdAt" | "updatedAt">,
): DemandAllocation {
  const now = new Date().toISOString();
  const row = db
    .insert(demandAllocations)
    .values({
      customerId: data.customerId,
      shiftId: data.shiftId ?? null,
      dayOfWeek: data.dayOfWeek ?? null,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo ?? null,
      allocatedMh: data.allocatedMh,
      mode: data.mode,
      reason: data.reason ?? null,
      isActive: data.isActive,
      createdBy: data.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  const custRow = db
    .select({ name: customers.name })
    .from(customers)
    .where(eq(customers.id, row.customerId))
    .get();

  return {
    id: row.id,
    customerId: row.customerId,
    customerName: custRow?.name ?? undefined,
    shiftId: row.shiftId,
    dayOfWeek: row.dayOfWeek,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    allocatedMh: row.allocatedMh,
    mode: row.mode as DemandAllocation["mode"],
    reason: row.reason,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateDemandAllocation(
  id: number,
  data: Partial<DemandAllocation>,
): DemandAllocation | null {
  const existing = db.select().from(demandAllocations).where(eq(demandAllocations.id, id)).get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.customerId !== undefined) updates.customerId = data.customerId;
  if (data.shiftId !== undefined) updates.shiftId = data.shiftId;
  if (data.dayOfWeek !== undefined) updates.dayOfWeek = data.dayOfWeek;
  if (data.effectiveFrom !== undefined) updates.effectiveFrom = data.effectiveFrom;
  if (data.effectiveTo !== undefined) updates.effectiveTo = data.effectiveTo;
  if (data.allocatedMh !== undefined) updates.allocatedMh = data.allocatedMh;
  if (data.mode !== undefined) updates.mode = data.mode;
  if (data.reason !== undefined) updates.reason = data.reason;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  db.update(demandAllocations).set(updates).where(eq(demandAllocations.id, id)).run();

  return loadDemandAllocation(id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteDemandAllocation(id: number): boolean {
  const existing = db.select().from(demandAllocations).where(eq(demandAllocations.id, id)).get();
  if (!existing) return false;
  db.delete(demandAllocations).where(eq(demandAllocations.id, id)).run();
  return true;
}

// ─── Customer Name Map ────────────────────────────────────────────────────────

/**
 * Load customer id -> name mapping for overview integration.
 */
export function loadCustomerNameMap(): Map<number, string> {
  const rows = db.select({ id: customers.id, name: customers.name }).from(customers).all();
  return new Map(rows.map((r) => [r.id, r.name]));
}

// ─── DTO Helper ───────────────────────────────────────────────────────────────

function toDTO(
  row: typeof demandAllocations.$inferSelect,
  customerNameMap: Map<number, string>,
): DemandAllocation {
  return {
    id: row.id,
    customerId: row.customerId,
    customerName: customerNameMap.get(row.customerId) ?? undefined,
    shiftId: row.shiftId,
    dayOfWeek: row.dayOfWeek,
    effectiveFrom: row.effectiveFrom,
    effectiveTo: row.effectiveTo,
    allocatedMh: row.allocatedMh,
    mode: row.mode as DemandAllocation["mode"],
    reason: row.reason,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
