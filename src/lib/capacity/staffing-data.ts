/**
 * Staffing Data Access Layer (v0.3.0)
 *
 * Drizzle queries for loading/saving rotation patterns, staffing configs,
 * and staffing shifts. All functions return plain objects.
 */

import { db } from "@/lib/db/client";
import { eq, and, sql } from "drizzle-orm";
import {
  rotationPatterns,
  rotationPresets,
  staffingConfigs,
  staffingShifts,
} from "@/lib/db/schema";
import type {
  RotationPattern,
  RotationPreset,
  StaffingConfig,
  StaffingConfigSummary,
  StaffingShift,
  StaffingShiftCategory,
} from "@/types";

// ─── Rotation Patterns ──────────────────────────────────────────────────────

/** Map a rotation_patterns row to the domain type. */
function mapPattern(r: typeof rotationPatterns.$inferSelect): RotationPattern {
  return {
    id: r.id,
    // Pre-M026 rows may still be null in flight; treat the row as its own group.
    groupId: r.groupId ?? r.id,
    name: r.name,
    description: r.description ?? null,
    pattern: r.pattern,
    effectiveFrom: r.effectiveFrom ?? null,
    effectiveTo: r.effectiveTo ?? null,
    isActive: r.isActive,
    sortOrder: r.sortOrder,
  };
}

/**
 * Load rotation patterns.
 *
 * OI-101: `activeOnly` narrows to currently-active versions for pickers and
 * lists. The capacity engine must NOT use it — superseded versions are needed
 * to resolve historical dates. Pass false (the default) there.
 */
export function loadRotationPatterns(activeOnly = false): RotationPattern[] {
  let query = db.select().from(rotationPatterns).orderBy(rotationPatterns.sortOrder);

  if (activeOnly) {
    query = query.where(eq(rotationPatterns.isActive, true)) as typeof query;
  }

  return query.all().map(mapPattern);
}

export function loadRotationPattern(id: number): RotationPattern | null {
  const row = db.select().from(rotationPatterns).where(eq(rotationPatterns.id, id)).get();

  if (!row) return null;
  return mapPattern(row);
}

export function createRotationPattern(data: {
  name: string;
  description?: string | null;
  pattern: string;
  groupId?: number | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
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
      groupId: data.groupId ?? null,
      effectiveFrom: data.effectiveFrom ?? null,
      effectiveTo: data.effectiveTo ?? null,
      isActive: data.isActive ?? true,
      sortOrder: data.sortOrder ?? 0,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  // A pattern with no explicit group is the founding version of its own group.
  if (data.groupId == null) {
    db.update(rotationPatterns)
      .set({ groupId: result.id })
      .where(eq(rotationPatterns.id, result.id))
      .run();
    result.groupId = result.id;
  }

  return mapPattern(result);
}

export function updateRotationPattern(
  id: number,
  data: Partial<{
    name: string;
    description: string | null;
    pattern: string;
    effectiveFrom: string | null;
    effectiveTo: string | null;
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
  return mapPattern(result);
}

/**
 * Version a rotation pattern — closes the current version and opens a new one
 * in the same group (OI-101).
 *
 * Editing a pattern in place rewrote which days were worked for every past date
 * that used it. Versioning instead freezes the outgoing definition, so shifts
 * resolving a historical date still see the pattern that was actually in force.
 *
 * Boundary matches shift versioning (OI-102): the new version takes effect on
 * the save date and the old one is closed the day before, so they never overlap.
 * Shifts keep pointing at their existing rotationId — resolution follows the
 * group, so nothing needs repointing.
 */
export function versionRotationPattern(
  id: number,
  changes: Partial<{
    name: string;
    description: string | null;
    pattern: string;
    sortOrder: number;
  }>,
): { archived: RotationPattern; created: RotationPattern } | null {
  const row = db.select().from(rotationPatterns).where(eq(rotationPatterns.id, id)).get();
  if (!row) return null;

  const today = new Date().toISOString().slice(0, 10);
  const group = row.groupId ?? row.id;

  // Nothing historical to protect if this version has not covered a completed
  // day yet — amend in place rather than leaving an inverted window behind.
  if (row.effectiveFrom !== null && today <= row.effectiveFrom) {
    const amended = updateRotationPattern(id, changes);
    if (!amended) return null;
    return { archived: amended, created: amended };
  }

  const archived = updateRotationPattern(id, {
    effectiveTo: addDays(today, -1),
    isActive: false,
  });
  if (!archived) return null;

  const created = createRotationPattern({
    name: changes.name ?? row.name,
    description:
      changes.description !== undefined ? changes.description : (row.description ?? null),
    pattern: changes.pattern ?? row.pattern,
    groupId: group,
    effectiveFrom: today,
    effectiveTo: null,
    isActive: true,
    sortOrder: changes.sortOrder ?? row.sortOrder,
  });

  return { archived, created };
}

/** Archive a rotation pattern version — closes its window as of today. */
export function archiveRotationPattern(id: number): RotationPattern | null {
  const today = new Date().toISOString().slice(0, 10);
  return updateRotationPattern(id, { effectiveTo: today, isActive: false });
}

/**
 * Is archiving this pattern safe — does any shift still reference its group
 * with no replacement version left open? Mirrors `canArchiveShift`.
 */
export function canArchiveRotationPattern(id: number): { safe: boolean; message?: string } {
  const row = db.select().from(rotationPatterns).where(eq(rotationPatterns.id, id)).get();
  if (!row) return { safe: false, message: "Pattern not found" };

  if (!isRotationPatternInUse(id)) return { safe: true };

  const group = row.groupId ?? row.id;
  const siblings = db
    .select()
    .from(rotationPatterns)
    .where(eq(rotationPatterns.groupId, group))
    .all();

  const hasOpenReplacement = siblings.some((s) => s.id !== id && s.isActive && !s.effectiveTo);
  if (hasOpenReplacement) return { safe: true };

  return {
    safe: false,
    message: `"${row.name}" is still used by active shifts and has no open replacement version. Archive anyway?`,
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
    rotationEndDate: r.rotationEndDate ?? null,
    patternAnchorDate: r.patternAnchorDate ?? null,
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
  rotationEndDate?: string | null;
  patternAnchorDate?: string | null;
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
      rotationEndDate: data.rotationEndDate ?? null,
      patternAnchorDate: data.patternAnchorDate ?? null,
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
    rotationEndDate: result.rotationEndDate ?? null,
    patternAnchorDate: result.patternAnchorDate ?? null,
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
    rotationEndDate: string | null;
    patternAnchorDate: string | null;
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
    rotationEndDate: result.rotationEndDate ?? null,
    patternAnchorDate: result.patternAnchorDate ?? null,
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

/** Archive a staffing shift — sets rotationEndDate to today, isActive to false */
export function archiveStaffingShift(id: number): StaffingShift | null {
  const today = new Date().toISOString().slice(0, 10);
  return updateStaffingShift(id, { rotationEndDate: today, isActive: false });
}

/** Shift a YYYY-MM-DD date by whole days (UTC-safe). */
function addDays(date: string, days: number): string {
  const d = new Date(date + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Version a staffing shift — closes the old version and opens a new one.
 *
 * OI-102 boundary rule: the new version takes effect on the **save date**, and
 * the old version is closed the day before, so the two never overlap and no
 * past date is restated. The new version inherits the old version's pattern
 * anchor, which keeps the rotation phase intact even though the effective start
 * is mid-week — that separation is what M025's `patternAnchorDate` exists for.
 *
 * Previously both roles lived on `rotationStartDate`, so the new version had to
 * start on the aligned Sunday to preserve the phase. That overlapped the old
 * version from Sunday through the save date and silently restated those days.
 */
export function versionStaffingShift(
  id: number,
  changes: Partial<{
    name: string;
    description: string | null;
    category: StaffingShiftCategory;
    rotationId: number;
    startHour: number;
    startMinute: number;
    endHour: number;
    endMinute: number;
    breakMinutes: number;
    lunchMinutes: number;
    mhOverride: number | null;
    headcount: number;
    sortOrder: number;
    // rotationStartDate is deliberately absent — the new version's effective
    // start is always the save date (OI-102), never caller-supplied.
  }>,
): { archived: StaffingShift; created: StaffingShift } | null {
  // Load existing shift
  const rows = db.select().from(staffingShifts).where(eq(staffingShifts.id, id)).all();
  if (rows.length === 0) return null;
  const old = rows[0];

  const today = new Date().toISOString().slice(0, 10);

  // If the current version has not yet covered a completed day — it starts today
  // or later — there is no history to preserve. Splitting would close it the day
  // before its own start, producing an inverted window. Amend in place instead.
  if (today <= old.rotationStartDate) {
    const amended = updateStaffingShift(id, changes);
    if (!amended) return null;
    return { archived: amended, created: amended };
  }

  // Close the old version the day BEFORE the new one opens — no overlap.
  const archived = updateStaffingShift(id, {
    rotationEndDate: addDays(today, -1),
    isActive: false,
  });
  if (!archived) return null;

  // The new version inherits the old anchor, so the rotation phase is preserved
  // even though the effective start is mid-week.
  const inheritedAnchor = old.patternAnchorDate ?? old.rotationStartDate;

  // Create new shift with changes applied
  const created = createStaffingShift({
    configId: old.configId,
    name: changes.name ?? old.name,
    description:
      changes.description !== undefined ? changes.description : (old.description ?? null),
    category: (changes.category ?? old.category) as StaffingShiftCategory,
    rotationId: changes.rotationId ?? old.rotationId ?? 0,
    rotationStartDate: today,
    rotationEndDate: null,
    patternAnchorDate: inheritedAnchor,
    startHour: changes.startHour ?? old.startHour,
    startMinute: changes.startMinute ?? old.startMinute,
    endHour: changes.endHour ?? old.endHour,
    endMinute: changes.endMinute ?? old.endMinute,
    breakMinutes: changes.breakMinutes ?? old.breakMinutes,
    lunchMinutes: changes.lunchMinutes ?? old.lunchMinutes,
    mhOverride: changes.mhOverride !== undefined ? changes.mhOverride : old.mhOverride,
    headcount: changes.headcount ?? old.headcount,
    isActive: true,
    sortOrder: changes.sortOrder ?? old.sortOrder,
  });

  return { archived, created };
}

// ─── Rotation Presets (reference library) ─────────────────────────────────────

export function loadRotationPresets(): RotationPreset[] {
  return db
    .select()
    .from(rotationPresets)
    .orderBy(rotationPresets.code)
    .all()
    .map((r) => ({
      id: r.id,
      code: r.code ?? null,
      name: r.name,
      description: r.description ?? null,
      pattern: r.pattern,
      sortOrder: r.sortOrder,
    }));
}

export function loadRotationPresetCount(): number {
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(rotationPresets)
    .get();
  return result?.count ?? 0;
}
