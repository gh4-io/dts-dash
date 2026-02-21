/**
 * Forecast Data Access Layer (P2-5)
 *
 * Drizzle queries for forecast models and rates CRUD.
 * Follows flight-events-data.ts patterns.
 */

import { db } from "@/lib/db/client";
import { eq, and, lte, gte, asc } from "drizzle-orm";
import { forecastModels, forecastRates } from "@/lib/db/schema";
import type { ForecastModel, ForecastRate, GeneratedForecastRate } from "@/types";

// ─── DTO Helpers ─────────────────────────────────────────────────────────────

function toModelDTO(row: typeof forecastModels.$inferSelect): ForecastModel {
  return {
    id: row.id,
    name: row.name,
    description: row.description,
    method: row.method as ForecastModel["method"],
    lookbackDays: row.lookbackDays,
    forecastHorizonDays: row.forecastHorizonDays,
    granularity: row.granularity as ForecastModel["granularity"],
    customerFilter: row.customerFilter,
    weightRecent: row.weightRecent,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

function toRateDTO(row: typeof forecastRates.$inferSelect, modelName?: string): ForecastRate {
  return {
    id: row.id,
    modelId: row.modelId,
    modelName,
    forecastDate: row.forecastDate,
    shiftCode: row.shiftCode,
    customer: row.customer,
    forecastedMh: row.forecastedMh,
    confidence: row.confidence,
    isManualOverride: row.isManualOverride,
    notes: row.notes,
    isActive: row.isActive,
    createdBy: row.createdBy ?? undefined,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

// ─── Forecast Models ─────────────────────────────────────────────────────────

/** Load all forecast models, optionally active-only */
export function loadForecastModels(activeOnly?: boolean): ForecastModel[] {
  const conditions = [];
  if (activeOnly) {
    conditions.push(eq(forecastModels.isActive, true));
  }

  const rows =
    conditions.length > 0
      ? db
          .select()
          .from(forecastModels)
          .where(and(...conditions))
          .orderBy(asc(forecastModels.id))
          .all()
      : db.select().from(forecastModels).orderBy(asc(forecastModels.id)).all();

  return rows.map(toModelDTO);
}

/** Load a single forecast model by ID */
export function loadForecastModel(id: number): ForecastModel | null {
  const row = db.select().from(forecastModels).where(eq(forecastModels.id, id)).get();
  return row ? toModelDTO(row) : null;
}

/** Load the first active forecast model (for overview integration) */
export function loadActiveForecastModel(): ForecastModel | null {
  const row = db
    .select()
    .from(forecastModels)
    .where(eq(forecastModels.isActive, true))
    .orderBy(asc(forecastModels.id))
    .limit(1)
    .get();
  return row ? toModelDTO(row) : null;
}

/** Create a new forecast model */
export function createForecastModel(
  data: Omit<ForecastModel, "id" | "createdAt" | "updatedAt">,
): ForecastModel {
  const now = new Date().toISOString();
  const result = db
    .insert(forecastModels)
    .values({
      name: data.name,
      description: data.description,
      method: data.method,
      lookbackDays: data.lookbackDays,
      forecastHorizonDays: data.forecastHorizonDays,
      granularity: data.granularity,
      customerFilter: data.customerFilter,
      weightRecent: data.weightRecent,
      isActive: data.isActive,
      createdBy: data.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  return toModelDTO(result);
}

/** Update a forecast model */
export function updateForecastModel(
  id: number,
  data: Partial<ForecastModel>,
): ForecastModel | null {
  const existing = loadForecastModel(id);
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.name !== undefined) updates.name = data.name;
  if (data.description !== undefined) updates.description = data.description;
  if (data.method !== undefined) updates.method = data.method;
  if (data.lookbackDays !== undefined) updates.lookbackDays = data.lookbackDays;
  if (data.forecastHorizonDays !== undefined)
    updates.forecastHorizonDays = data.forecastHorizonDays;
  if (data.granularity !== undefined) updates.granularity = data.granularity;
  if (data.customerFilter !== undefined) updates.customerFilter = data.customerFilter;
  if (data.weightRecent !== undefined) updates.weightRecent = data.weightRecent;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  db.update(forecastModels).set(updates).where(eq(forecastModels.id, id)).run();

  return loadForecastModel(id);
}

/** Delete a forecast model (cascades to its rates via ON DELETE CASCADE) */
export function deleteForecastModel(id: number): boolean {
  const result = db.delete(forecastModels).where(eq(forecastModels.id, id)).run();
  return result.changes > 0;
}

// ─── Forecast Rates ──────────────────────────────────────────────────────────

/** Load rates for a model, optionally filtered by date range */
export function loadForecastRates(
  modelId: number,
  startDate?: string,
  endDate?: string,
  activeOnly?: boolean,
): ForecastRate[] {
  const conditions = [eq(forecastRates.modelId, modelId)];

  if (startDate) conditions.push(gte(forecastRates.forecastDate, startDate));
  if (endDate) conditions.push(lte(forecastRates.forecastDate, endDate));
  if (activeOnly) conditions.push(eq(forecastRates.isActive, true));

  const rows = db
    .select()
    .from(forecastRates)
    .where(and(...conditions))
    .orderBy(asc(forecastRates.forecastDate))
    .all();

  // Look up model name once for display
  const model = loadForecastModel(modelId);
  const modelName = model?.name;

  return rows.map((row) => toRateDTO(row, modelName));
}

/** Load a single forecast rate by ID */
export function loadForecastRate(id: number): ForecastRate | null {
  const row = db.select().from(forecastRates).where(eq(forecastRates.id, id)).get();
  if (!row) return null;

  const model = loadForecastModel(row.modelId);
  return toRateDTO(row, model?.name);
}

/** Create a single forecast rate */
export function createForecastRate(
  data: Omit<ForecastRate, "id" | "modelName" | "createdAt" | "updatedAt">,
): ForecastRate {
  const now = new Date().toISOString();
  const result = db
    .insert(forecastRates)
    .values({
      modelId: data.modelId,
      forecastDate: data.forecastDate,
      shiftCode: data.shiftCode,
      customer: data.customer,
      forecastedMh: data.forecastedMh,
      confidence: data.confidence,
      isManualOverride: data.isManualOverride,
      notes: data.notes,
      isActive: data.isActive,
      createdBy: data.createdBy ?? null,
      createdAt: now,
      updatedAt: now,
    })
    .returning()
    .get();

  const model = loadForecastModel(data.modelId);
  return toRateDTO(result, model?.name);
}

/**
 * Bulk-insert generated forecast rates.
 * Deletes existing non-manual rates for the model first, then inserts.
 * Returns count of inserted rows.
 */
export function bulkInsertForecastRates(
  modelId: number,
  rates: GeneratedForecastRate[],
  createdBy: number,
): number {
  if (rates.length === 0) return 0;

  const now = new Date().toISOString();

  // Delete existing non-manual rates for this model
  db.delete(forecastRates)
    .where(and(eq(forecastRates.modelId, modelId), eq(forecastRates.isManualOverride, false)))
    .run();

  // Insert new rates
  let count = 0;
  for (const rate of rates) {
    db.insert(forecastRates)
      .values({
        modelId,
        forecastDate: rate.forecastDate,
        shiftCode: rate.shiftCode,
        customer: rate.customer,
        forecastedMh: rate.forecastedMh,
        confidence: rate.confidence,
        isManualOverride: false,
        notes: null,
        isActive: true,
        createdBy,
        createdAt: now,
        updatedAt: now,
      })
      .run();
    count++;
  }

  return count;
}

/** Update a single forecast rate */
export function updateForecastRate(id: number, data: Partial<ForecastRate>): ForecastRate | null {
  const existing = loadForecastRate(id);
  if (!existing) return null;

  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };

  if (data.forecastDate !== undefined) updates.forecastDate = data.forecastDate;
  if (data.shiftCode !== undefined) updates.shiftCode = data.shiftCode;
  if (data.customer !== undefined) updates.customer = data.customer;
  if (data.forecastedMh !== undefined) updates.forecastedMh = data.forecastedMh;
  if (data.confidence !== undefined) updates.confidence = data.confidence;
  if (data.isManualOverride !== undefined) updates.isManualOverride = data.isManualOverride;
  if (data.notes !== undefined) updates.notes = data.notes;
  if (data.isActive !== undefined) updates.isActive = data.isActive;

  db.update(forecastRates).set(updates).where(eq(forecastRates.id, id)).run();

  return loadForecastRate(id);
}

/** Delete a single forecast rate */
export function deleteForecastRate(id: number): boolean {
  const result = db.delete(forecastRates).where(eq(forecastRates.id, id)).run();
  return result.changes > 0;
}

/** Delete all non-manual rates for a model */
export function clearGeneratedRates(modelId: number): number {
  const result = db
    .delete(forecastRates)
    .where(and(eq(forecastRates.modelId, modelId), eq(forecastRates.isManualOverride, false)))
    .run();
  return result.changes;
}
