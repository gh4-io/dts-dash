/**
 * Weekly MH Projections Data Access Layer (TEMPORARY — OI-067)
 *
 * Drizzle queries for weekly projection CRUD.
 * No FKs to customers table — uses plain text names for easy removal.
 */

import { db, sqlite } from "@/lib/db/client";
import { eq } from "drizzle-orm";
import { weeklyMhProjections } from "@/lib/db/schema";
import type { WeeklyProjection } from "@/types";

// ─── DTO mapper ──────────────────────────────────────────────────────────────

function toDTO(row: typeof weeklyMhProjections.$inferSelect): WeeklyProjection {
  return {
    id: row.id,
    customer: row.customer,
    dayOfWeek: row.dayOfWeek,
    shiftCode: row.shiftCode as WeeklyProjection["shiftCode"],
    projectedMh: row.projectedMh,
    notes: row.notes,
    isActive: row.isActive,
    createdBy: row.createdBy,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Load ────────────────────────────────────────────────────────────────────

/** Load all projections (optionally only active) */
export function loadWeeklyProjections(activeOnly = false): WeeklyProjection[] {
  const rows = activeOnly
    ? db.select().from(weeklyMhProjections).where(eq(weeklyMhProjections.isActive, true)).all()
    : db.select().from(weeklyMhProjections).all();

  return rows.map(toDTO);
}

// ─── Bulk Save (Upsert) ─────────────────────────────────────────────────────

export interface ProjectionUpsertRow {
  customer: string;
  dayOfWeek: number;
  shiftCode: string;
  projectedMh: number;
  notes?: string | null;
  isActive?: boolean;
}

/**
 * Bulk upsert projections. Each row is matched by (customer, dayOfWeek, shiftCode).
 * Existing rows are updated; new rows are inserted.
 * Returns the count of upserted rows.
 */
export function bulkSaveProjections(rows: ProjectionUpsertRow[], userId: number): number {
  const now = new Date().toISOString();

  const stmt = sqlite.prepare(`
    INSERT INTO weekly_mh_projections (customer, day_of_week, shift_code, projected_mh, notes, is_active, created_by, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(customer, day_of_week, shift_code)
    DO UPDATE SET projected_mh = excluded.projected_mh, notes = excluded.notes, is_active = excluded.is_active, updated_at = excluded.updated_at
  `);

  const runAll = sqlite.transaction(() => {
    let count = 0;
    for (const row of rows) {
      stmt.run(
        row.customer,
        row.dayOfWeek,
        row.shiftCode,
        row.projectedMh,
        row.notes ?? null,
        row.isActive !== false ? 1 : 0,
        userId,
        now,
        now,
      );
      count++;
    }
    return count;
  });

  return runAll();
}

// ─── Delete ──────────────────────────────────────────────────────────────────

/** Delete all projections (clear the table) */
export function deleteAllProjections(): number {
  const result = db.delete(weeklyMhProjections).run();
  return result.changes;
}
