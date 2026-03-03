/**
 * Billing Entries Data Access Layer (P2-3: Billed Hours)
 *
 * Drizzle queries for billing entries CRUD.
 * Follows time-bookings-data.ts patterns.
 */

import { db } from "@/lib/db/client";
import { eq, and, gte, lte } from "drizzle-orm";
import { billingEntries } from "@/lib/db/schema";
import type { BillingEntry, BillingEntrySource } from "@/types";

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load billing entries, optionally filtered by date range.
 */
export function loadBillingEntries(
  startDate?: string,
  endDate?: string,
  activeOnly?: boolean,
): BillingEntry[] {
  const conditions = [];

  if (activeOnly) {
    conditions.push(eq(billingEntries.isActive, true));
  }

  if (startDate) {
    conditions.push(gte(billingEntries.billingDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(billingEntries.billingDate, endDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = where
    ? db.select().from(billingEntries).where(where).all()
    : db.select().from(billingEntries).all();

  return rows.map(toDTO);
}

/**
 * Load a single billing entry by ID.
 */
export function loadBillingEntry(id: number): BillingEntry | null {
  const row = db.select().from(billingEntries).where(eq(billingEntries.id, id)).get();
  return row ? toDTO(row) : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createBillingEntry(
  data: Omit<BillingEntry, "id" | "createdAt" | "updatedAt">,
): BillingEntry {
  const now = new Date().toISOString();
  const row = db
    .insert(billingEntries)
    .values({
      workPackageId: data.workPackageId ?? null,
      aircraftReg: data.aircraftReg,
      customer: data.customer,
      billingDate: data.billingDate,
      shiftCode: data.shiftCode,
      description: data.description ?? null,
      billedMh: data.billedMh,
      invoiceRef: data.invoiceRef ?? null,
      notes: data.notes ?? null,
      source: data.source ?? "manual",
      isActive: data.isActive,
      createdBy: data.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return toDTO(row);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateBillingEntry(id: number, data: Partial<BillingEntry>): BillingEntry | null {
  const existing = db.select().from(billingEntries).where(eq(billingEntries.id, id)).get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.workPackageId !== undefined) updates.workPackageId = data.workPackageId;
  if (data.aircraftReg !== undefined) updates.aircraftReg = data.aircraftReg;
  if (data.customer !== undefined) updates.customer = data.customer;
  if (data.billingDate !== undefined) updates.billingDate = data.billingDate;
  if (data.shiftCode !== undefined) updates.shiftCode = data.shiftCode;
  if (data.description !== undefined) updates.description = data.description;
  if (data.billedMh !== undefined) updates.billedMh = data.billedMh;
  if (data.invoiceRef !== undefined) updates.invoiceRef = data.invoiceRef;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.source !== undefined) updates.source = data.source;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  db.update(billingEntries).set(updates).where(eq(billingEntries.id, id)).run();

  return loadBillingEntry(id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteBillingEntry(id: number): boolean {
  const existing = db.select().from(billingEntries).where(eq(billingEntries.id, id)).get();
  if (!existing) return false;
  db.delete(billingEntries).where(eq(billingEntries.id, id)).run();
  return true;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function toDTO(row: typeof billingEntries.$inferSelect): BillingEntry {
  return {
    id: row.id,
    workPackageId: row.workPackageId,
    aircraftReg: row.aircraftReg,
    customer: row.customer,
    billingDate: row.billingDate,
    shiftCode: row.shiftCode,
    description: row.description,
    billedMh: row.billedMh,
    invoiceRef: row.invoiceRef,
    notes: row.notes,
    source: row.source as BillingEntrySource,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
