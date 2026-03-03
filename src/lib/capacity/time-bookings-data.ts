/**
 * Time Bookings Data Access Layer (P2-2: Worked Hours)
 *
 * Drizzle queries for time bookings CRUD.
 * Follows allocation-data.ts patterns.
 */

import { db } from "@/lib/db/client";
import { eq, and, gte, lte } from "drizzle-orm";
import { timeBookings } from "@/lib/db/schema";
import type { TimeBooking, TimeBookingTaskType, TimeBookingSource } from "@/types";

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load time bookings, optionally filtered by date range.
 */
export function loadTimeBookings(
  startDate?: string,
  endDate?: string,
  activeOnly?: boolean,
): TimeBooking[] {
  const conditions = [];

  if (activeOnly) {
    conditions.push(eq(timeBookings.isActive, true));
  }

  if (startDate) {
    conditions.push(gte(timeBookings.bookingDate, startDate));
  }
  if (endDate) {
    conditions.push(lte(timeBookings.bookingDate, endDate));
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = where
    ? db.select().from(timeBookings).where(where).all()
    : db.select().from(timeBookings).all();

  return rows.map(toDTO);
}

/**
 * Load a single time booking by ID.
 */
export function loadTimeBooking(id: number): TimeBooking | null {
  const row = db.select().from(timeBookings).where(eq(timeBookings.id, id)).get();
  return row ? toDTO(row) : null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createTimeBooking(
  data: Omit<TimeBooking, "id" | "createdAt" | "updatedAt">,
): TimeBooking {
  const now = new Date().toISOString();
  const row = db
    .insert(timeBookings)
    .values({
      workPackageId: data.workPackageId ?? null,
      aircraftReg: data.aircraftReg,
      customer: data.customer,
      bookingDate: data.bookingDate,
      shiftCode: data.shiftCode,
      taskName: data.taskName ?? null,
      taskType: data.taskType ?? "routine",
      workedMh: data.workedMh,
      technicianCount: data.technicianCount ?? null,
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

export function updateTimeBooking(id: number, data: Partial<TimeBooking>): TimeBooking | null {
  const existing = db.select().from(timeBookings).where(eq(timeBookings.id, id)).get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.workPackageId !== undefined) updates.workPackageId = data.workPackageId;
  if (data.aircraftReg !== undefined) updates.aircraftReg = data.aircraftReg;
  if (data.customer !== undefined) updates.customer = data.customer;
  if (data.bookingDate !== undefined) updates.bookingDate = data.bookingDate;
  if (data.shiftCode !== undefined) updates.shiftCode = data.shiftCode;
  if (data.taskName !== undefined) updates.taskName = data.taskName;
  if (data.taskType !== undefined) updates.taskType = data.taskType;
  if (data.workedMh !== undefined) updates.workedMh = data.workedMh;
  if (data.technicianCount !== undefined) updates.technicianCount = data.technicianCount;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.source !== undefined) updates.source = data.source;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  db.update(timeBookings).set(updates).where(eq(timeBookings.id, id)).run();

  return loadTimeBooking(id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteTimeBooking(id: number): boolean {
  const existing = db.select().from(timeBookings).where(eq(timeBookings.id, id)).get();
  if (!existing) return false;
  db.delete(timeBookings).where(eq(timeBookings.id, id)).run();
  return true;
}

// ─── Internal ─────────────────────────────────────────────────────────────────

function toDTO(row: typeof timeBookings.$inferSelect): TimeBooking {
  return {
    id: row.id,
    workPackageId: row.workPackageId,
    aircraftReg: row.aircraftReg,
    customer: row.customer,
    bookingDate: row.bookingDate,
    shiftCode: row.shiftCode,
    taskName: row.taskName,
    taskType: row.taskType as TimeBookingTaskType,
    workedMh: row.workedMh,
    technicianCount: row.technicianCount,
    notes: row.notes,
    source: row.source as TimeBookingSource,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
