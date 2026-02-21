/**
 * Staffing Data Access Layer (v0.3.0)
 *
 * Drizzle queries for loading/saving rotation patterns, staffing configs,
 * and staffing shifts. All functions return plain objects.
 */

import { db } from "@/lib/db/client";
import { eq, and, sql } from "drizzle-orm";
import { rotationPatterns, staffingConfigs, staffingShifts } from "@/lib/db/schema";
import type {
  RotationPattern,
  StaffingConfig,
  StaffingConfigSummary,
  StaffingShift,
  StaffingShiftCategory,
} from "@/types";

// ─── Rotation Patterns ──────────────────────────────────────────────────────

export function loadRotationPatterns(activeOnly = false): RotationPattern[] {
  let query = db.select().from(rotationPatterns).orderBy(rotationPatterns.sortOrder);

  if (activeOnly) {
    query = query.where(eq(rotationPatterns.isActive, true)) as typeof query;
  }

  return query.all().map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description ?? null,
    pattern: r.pattern,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}

export function loadRotationPattern(id: number): RotationPattern | null {
  const row = db.select().from(rotationPatterns).where(eq(rotationPatterns.id, id)).get();

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    pattern: row.pattern,
    isActive: row.isActive,
    sortOrder: row.sortOrder,
  };
}

export function createRotationPattern(data: {
  name: string;
  description?: string | null;
  pattern: string;
  isActive?: boolean;
  sortOrder?: number;
}): RotationPattern {
  const now = new Date().toISOString();
  const result = db
    .insert(rotationPatterns)
    .values({
      name: data.name,
      description: data.description ?? null,
      pattern: data.pattern,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return {
    id: result.id,
    name: result.name,
    description: result.description ?? null,
    pattern: result.pattern,
    isActive: result.isActive,
    sortOrder: result.sortOrder,
  };
}

export function updateRotationPattern(
  id: number,
  data: Partial<{
    name: string;
    description: string | null;
    pattern: string;
    isActive: boolean;
    sortOrder: number;
  }>,
): RotationPattern | null {
  const now = new Date().toISOString();
  const result = db
    .update(rotationPatterns)
    .set({ ...data, updatedAt: now })
    .where(eq(rotationPatterns.id, id))
    .returning()
    .get();

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    description: result.description ?? null,
    pattern: result.pattern,
    isActive: result.isActive,
    sortOrder: result.sortOrder,
  };
}

export function deleteRotationPattern(id: number): boolean {
  // Detach any shifts referencing this pattern (set rotationId to 0 = orphaned)
  db.update(staffingShifts)
    .set({ rotationId: 0, updatedAt: new Date().toISOString() })
    .where(eq(staffingShifts.rotationId, id))
    .run();

  const result = db.delete(rotationPatterns).where(eq(rotationPatterns.id, id)).returning().get();

  return !!result;
}

/** Check if a rotation pattern is referenced by any staffing shift */
export function isRotationPatternInUse(id: number): boolean {
  const row = db
    .select({ count: sql<number>`COUNT(*)` })
    .from(staffingShifts)
    .where(eq(staffingShifts.rotationId, id))
    .get();

  return (row?.count ?? 0) > 0;
}

// ─── Staffing Configs ───────────────────────────────────────────────────────

export function loadStaffingConfigs(): StaffingConfigSummary[] {
  const configs = db.select().from(staffingConfigs).orderBy(staffingConfigs.createdAt).all();

  return configs.map((c) => {
    const stats = db
      .select({
        shiftCount: sql<number>`COUNT(*)`,
        totalHeadcount: sql<number>`COALESCE(SUM(headcount), 0)`,
      })
      .from(staffingShifts)
      .where(and(eq(staffingShifts.configId, c.id), eq(staffingShifts.isActive, true)))
      .get();

    return {
      id: c.id,
      name: c.name,
      description: c.description,
      isActive: c.isActive,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      shiftCount: stats?.shiftCount ?? 0,
      totalHeadcount: stats?.totalHeadcount ?? 0,
    };
  });
}

export function loadActiveStaffingConfig(): StaffingConfig | null {
  const row = db
    .select()
    .from(staffingConfigs)
    .where(eq(staffingConfigs.isActive, true))
    .limit(1)
    .get();

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function loadStaffingConfig(id: number): StaffingConfig | null {
  const row = db.select().from(staffingConfigs).where(eq(staffingConfigs.id, id)).get();

  if (!row) return null;

  return {
    id: row.id,
    name: row.name,
    description: row.description,
    isActive: row.isActive,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function createStaffingConfig(data: {
  name: string;
  description?: string;
  createdBy?: number;
}): StaffingConfig {
  const now = new Date().toISOString();
  const result = db
    .insert(staffingConfigs)
    .values({
      name: data.name,
      description: data.description ?? null,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      createdBy: data.createdBy ?? null,
    })
    .returning()
    .get();

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    isActive: result.isActive,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export function updateStaffingConfig(
  id: number,
  data: Partial<{ name: string; description: string }>,
): StaffingConfig | null {
  const now = new Date().toISOString();
  const result = db
    .update(staffingConfigs)
    .set({ ...data, updatedAt: now })
    .where(eq(staffingConfigs.id, id))
    .returning()
    .get();

  if (!result) return null;

  return {
    id: result.id,
    name: result.name,
    description: result.description,
    isActive: result.isActive,
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  };
}

export function deleteStaffingConfig(id: number): boolean {
  const result = db.delete(staffingConfigs).where(eq(staffingConfigs.id, id)).returning().get();

  return !!result;
}

/** Activate a config (deactivates all others) */
export function activateStaffingConfig(id: number): boolean {
  const now = new Date().toISOString();

  // Deactivate all
  db.update(staffingConfigs).set({ isActive: false, updatedAt: now }).run();

  // Activate target
  const result = db
    .update(staffingConfigs)
    .set({ isActive: true, updatedAt: now })
    .where(eq(staffingConfigs.id, id))
    .returning()
    .get();

  return !!result;
}

/** Deep copy a config and all its shifts */
export function duplicateStaffingConfig(
  sourceId: number,
  newName: string,
  createdBy?: number,
): StaffingConfig | null {
  const source = loadStaffingConfig(sourceId);
  if (!source) return null;

  const now = new Date().toISOString();

  // Create new config
  const newConfig = db
    .insert(staffingConfigs)
    .values({
      name: newName,
      description: source.description
        ? `Duplicated from "${source.name}". ${source.description}`
        : `Duplicated from "${source.name}"`,
      isActive: false,
      createdAt: now,
      updatedAt: now,
      createdBy: createdBy ?? null,
    })
    .returning()
    .get();

  // Copy all shifts
  const sourceShifts = loadStaffingShifts(sourceId);
  for (const shift of sourceShifts) {
    db.insert(staffingShifts)
      .values({
        configId: newConfig.id,
        name: shift.name,
        category: shift.category,
        rotationId: shift.rotationId,
        rotationStartDate: shift.rotationStartDate,
        startHour: shift.startHour,
        startMinute: shift.startMinute,
        endHour: shift.endHour,
        endMinute: shift.endMinute,
        breakMinutes: shift.breakMinutes,
        lunchMinutes: shift.lunchMinutes,
        mhOverride: shift.mhOverride,
        headcount: shift.headcount,
        isActive: shift.isActive,
        sortOrder: shift.sortOrder,
        createdAt: now,
        updatedAt: now,
      })
      .run();
  }

  return {
    id: newConfig.id,
    name: newConfig.name,
    description: newConfig.description,
    isActive: newConfig.isActive,
    createdAt: newConfig.createdAt,
    updatedAt: newConfig.updatedAt,
  };
}

// ─── Staffing Shifts ────────────────────────────────────────────────────────

export function loadStaffingShifts(configId: number): StaffingShift[] {
  const rows = db
    .select()
    .from(staffingShifts)
    .where(eq(staffingShifts.configId, configId))
    .orderBy(staffingShifts.sortOrder)
    .all();

  return rows.map((r) => ({
    id: r.id,
    configId: r.configId,
    name: r.name,
    description: r.description ?? null,
    category: r.category as StaffingShiftCategory,
    rotationId: r.rotationId ?? 0,
    rotationStartDate: r.rotationStartDate,
    startHour: r.startHour,
    startMinute: r.startMinute,
    endHour: r.endHour,
    endMinute: r.endMinute,
    breakMinutes: r.breakMinutes,
    lunchMinutes: r.lunchMinutes,
    mhOverride: r.mhOverride,
    headcount: r.headcount,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  }));
}

export function createStaffingShift(data: {
  configId: number;
  name: string;
  description?: string | null;
  category: StaffingShiftCategory;
  rotationId: number;
  rotationStartDate: string;
  startHour: number;
  startMinute?: number;
  endHour: number;
  endMinute?: number;
  breakMinutes?: number;
  lunchMinutes?: number;
  mhOverride?: number | null;
  headcount: number;
  isActive?: boolean;
  sortOrder?: number;
}): StaffingShift {
  const now = new Date().toISOString();
  const result = db
    .insert(staffingShifts)
    .values({
      configId: data.configId,
      name: data.name,
      description: data.description ?? null,
      category: data.category,
      rotationId: data.rotationId,
      rotationStartDate: data.rotationStartDate,
      startHour: data.startHour,
      startMinute: data.startMinute ?? 0,
      endHour: data.endHour,
      endMinute: data.endMinute ?? 0,
      breakMinutes: data.breakMinutes ?? 0,
      lunchMinutes: data.lunchMinutes ?? 0,
      mhOverride: data.mhOverride ?? null,
      headcount: data.headcount,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return {
    id: result.id,
    configId: result.configId,
    name: result.name,
    description: result.description ?? null,
    category: result.category as StaffingShiftCategory,
    rotationId: result.rotationId ?? 0,
    rotationStartDate: result.rotationStartDate,
    startHour: result.startHour,
    startMinute: result.startMinute,
    endHour: result.endHour,
    endMinute: result.endMinute,
    breakMinutes: result.breakMinutes,
    lunchMinutes: result.lunchMinutes,
    mhOverride: result.mhOverride,
    headcount: result.headcount,
    isActive: result.isActive,
    sortOrder: result.sortOrder,
  };
}

export function updateStaffingShift(
  id: number,
  data: Partial<{
    name: string;
    category: StaffingShiftCategory;
    rotationId: number;
    rotationStartDate: string;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    breakMinutes: number;
    lunchMinutes: number;
    mhOverride: number | null;
    headcount: number;
    isActive: boolean;
    sortOrder: number;
  }>,
): StaffingShift | null {
  const now = new Date().toISOString();
  const result = db
    .update(staffingShifts)
    .set({ ...data, updatedAt: now })
    .where(eq(staffingShifts.id, id))
    .returning()
    .get();

  if (!result) return null;

  return {
    id: result.id,
    configId: result.configId,
    name: result.name,
    description: result.description ?? null,
    category: result.category as StaffingShiftCategory,
    rotationId: result.rotationId ?? 0,
    rotationStartDate: result.rotationStartDate,
    startHour: result.startHour,
    startMinute: result.startMinute,
    endHour: result.endHour,
    endMinute: result.endMinute,
    breakMinutes: result.breakMinutes,
    lunchMinutes: result.lunchMinutes,
    mhOverride: result.mhOverride,
    headcount: result.headcount,
    isActive: result.isActive,
    sortOrder: result.sortOrder,
  };
}

export function deleteStaffingShift(id: number): boolean {
  const result = db.delete(staffingShifts).where(eq(staffingShifts.id, id)).returning().get();

  return !!result;
}
