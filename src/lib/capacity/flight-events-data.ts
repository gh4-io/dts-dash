/**
 * Flight Events Data Access Layer (P2-1)
 *
 * Drizzle queries for flight events CRUD.
 * Follows allocation-data.ts patterns.
 */

import { db } from "@/lib/db/client";
import { eq, and, or, lte, gte } from "drizzle-orm";
import { flightEvents } from "@/lib/db/schema";
import type { FlightEvent, FlightEventStatus, FlightEventSource } from "@/types";

// ─── Load ─────────────────────────────────────────────────────────────────────

/**
 * Load flight events, optionally filtered by date range.
 * Date range matches if ANY of the 4 datetime columns falls within range,
 * OR if the event is a recurring template whose recurrence range overlaps.
 */
export function loadFlightEvents(
  startDate?: string,
  endDate?: string,
  activeOnly?: boolean,
): FlightEvent[] {
  const conditions = [];

  if (activeOnly) {
    conditions.push(eq(flightEvents.isActive, true));
  }

  if (startDate && endDate) {
    const startISO = startDate.includes("T") ? startDate : startDate + "T00:00:00.000Z";
    const endISO = endDate.includes("T") ? endDate : endDate + "T23:59:59.999Z";
    // Extract date-only for recurring range comparison
    const startDateOnly = startDate.split("T")[0];
    const endDateOnly = endDate.split("T")[0];

    conditions.push(
      or(
        // One-off events: any datetime column overlaps [startDate, endDate]
        and(
          gte(flightEvents.scheduledArrival, startISO),
          lte(flightEvents.scheduledArrival, endISO),
        ),
        and(gte(flightEvents.actualArrival, startISO), lte(flightEvents.actualArrival, endISO)),
        and(
          gte(flightEvents.scheduledDeparture, startISO),
          lte(flightEvents.scheduledDeparture, endISO),
        ),
        and(gte(flightEvents.actualDeparture, startISO), lte(flightEvents.actualDeparture, endISO)),
        // Recurring templates: recurrence range overlaps query range
        and(
          eq(flightEvents.isRecurring, true),
          lte(flightEvents.recurrenceStart, endDateOnly),
          gte(flightEvents.recurrenceEnd, startDateOnly),
        ),
      ),
    );
  }

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  const rows = where
    ? db.select().from(flightEvents).where(where).all()
    : db.select().from(flightEvents).all();

  return rows.map(toDTO);
}

/**
 * Load a single flight event by ID.
 */
export function loadFlightEvent(id: number): FlightEvent | null {
  const row = db.select().from(flightEvents).where(eq(flightEvents.id, id)).get();
  if (!row) return null;
  return toDTO(row);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export function createFlightEvent(
  data: Omit<FlightEvent, "id" | "createdAt" | "updatedAt">,
): FlightEvent {
  const now = new Date().toISOString();
  const row = db
    .insert(flightEvents)
    .values({
      workPackageId: data.workPackageId ?? null,
      aircraftReg: data.aircraftReg ?? null,
      customer: data.customer,
      scheduledArrival: data.scheduledArrival ?? null,
      actualArrival: data.actualArrival ?? null,
      scheduledDeparture: data.scheduledDeparture ?? null,
      actualDeparture: data.actualDeparture ?? null,
      arrivalWindowMinutes: data.arrivalWindowMinutes ?? 30,
      departureWindowMinutes: data.departureWindowMinutes ?? 60,
      status: data.status,
      source: data.source,
      notes: data.notes ?? null,
      isActive: data.isActive ?? true,
      isRecurring: data.isRecurring ?? false,
      dayPattern: data.dayPattern ?? null,
      recurrenceStart: data.recurrenceStart ?? null,
      recurrenceEnd: data.recurrenceEnd ?? null,
      arrivalTimeUtc: data.arrivalTimeUtc ?? null,
      departureTimeUtc: data.departureTimeUtc ?? null,
      suppressedDates: JSON.stringify(data.suppressedDates ?? []),
      createdBy: data.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return toDTO(row);
}

// ─── Update ───────────────────────────────────────────────────────────────────

export function updateFlightEvent(id: number, data: Partial<FlightEvent>): FlightEvent | null {
  const existing = db.select().from(flightEvents).where(eq(flightEvents.id, id)).get();
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.workPackageId !== undefined) updates.workPackageId = data.workPackageId;
  if (data.aircraftReg !== undefined) updates.aircraftReg = data.aircraftReg;
  if (data.customer !== undefined) updates.customer = data.customer;
  if (data.scheduledArrival !== undefined) updates.scheduledArrival = data.scheduledArrival;
  if (data.actualArrival !== undefined) updates.actualArrival = data.actualArrival;
  if (data.scheduledDeparture !== undefined) updates.scheduledDeparture = data.scheduledDeparture;
  if (data.actualDeparture !== undefined) updates.actualDeparture = data.actualDeparture;
  if (data.arrivalWindowMinutes !== undefined)
    updates.arrivalWindowMinutes = data.arrivalWindowMinutes;
  if (data.departureWindowMinutes !== undefined)
    updates.departureWindowMinutes = data.departureWindowMinutes;
  if (data.status !== undefined) updates.status = data.status;
  if (data.source !== undefined) updates.source = data.source;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) updates.isActive = data.isActive;
  if (data.isRecurring !== undefined) updates.isRecurring = data.isRecurring;
  if (data.dayPattern !== undefined) updates.dayPattern = data.dayPattern;
  if (data.recurrenceStart !== undefined) updates.recurrenceStart = data.recurrenceStart;
  if (data.recurrenceEnd !== undefined) updates.recurrenceEnd = data.recurrenceEnd;
  if (data.arrivalTimeUtc !== undefined) updates.arrivalTimeUtc = data.arrivalTimeUtc;
  if (data.departureTimeUtc !== undefined) updates.departureTimeUtc = data.departureTimeUtc;
  if (data.suppressedDates !== undefined)
    updates.suppressedDates = JSON.stringify(data.suppressedDates);

  db.update(flightEvents).set(updates).where(eq(flightEvents.id, id)).run();

  return loadFlightEvent(id);
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export function deleteFlightEvent(id: number): boolean {
  const existing = db.select().from(flightEvents).where(eq(flightEvents.id, id)).get();
  if (!existing) return false;
  db.delete(flightEvents).where(eq(flightEvents.id, id)).run();
  return true;
}

// ─── DTO Helper ───────────────────────────────────────────────────────────────

function toDTO(row: typeof flightEvents.$inferSelect): FlightEvent {
  let suppressedDates: string[] = [];
  if (row.suppressedDates) {
    try {
      suppressedDates = JSON.parse(row.suppressedDates);
    } catch {
      suppressedDates = [];
    }
  }

  return {
    id: row.id,
    workPackageId: row.workPackageId,
    aircraftReg: row.aircraftReg,
    customer: row.customer,
    scheduledArrival: row.scheduledArrival,
    actualArrival: row.actualArrival,
    scheduledDeparture: row.scheduledDeparture,
    actualDeparture: row.actualDeparture,
    arrivalWindowMinutes: row.arrivalWindowMinutes,
    departureWindowMinutes: row.departureWindowMinutes,
    status: row.status as FlightEventStatus,
    source: row.source as FlightEventSource,
    notes: row.notes,
    isActive: row.isActive,
    isRecurring: row.isRecurring,
    dayPattern: row.dayPattern,
    recurrenceStart: row.recurrenceStart,
    recurrenceEnd: row.recurrenceEnd,
    arrivalTimeUtc: row.arrivalTimeUtc,
    departureTimeUtc: row.departureTimeUtc,
    suppressedDates,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}
