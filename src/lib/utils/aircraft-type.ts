import { db } from "@/lib/db/client";
import { aircraftTypeMappings } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import type { AircraftTypeMapping, NormalizedAircraftType } from "@/types";

/**
 * Aircraft Type Normalization Service (D-015)
 * Resolves raw aircraft type strings or registration patterns to canonical types
 * Uses admin-configurable mapping table with pattern matching
 */

let cachedMappings: AircraftTypeMapping[] | null = null;

/**
 * Load mappings from SQLite, cache on first call
 */
async function loadMappings(): Promise<AircraftTypeMapping[]> {
  if (cachedMappings) {
    return cachedMappings;
  }

  try {
    const mappings = await db
      .select()
      .from(aircraftTypeMappings)
      .where(eq(aircraftTypeMappings.isActive, true))
      .orderBy(aircraftTypeMappings.priority);

    cachedMappings = mappings.map((m) => ({
      ...m,
      description: m.description ?? null,
    }));

    console.log(`[aircraft-type] Loaded ${cachedMappings.length} active mappings`);
    return cachedMappings;
  } catch (error) {
    console.error("[aircraft-type] Failed to load mappings:", error);
    return [];
  }
}

/**
 * Invalidate the mappings cache (e.g., after admin edits)
 */
export function invalidateMappingsCache(): void {
  cachedMappings = null;
  console.log("[aircraft-type] Mappings cache invalidated");
}

/**
 * Normalize aircraft type or registration to canonical type
 * Resolution order: exact match → pattern match (descending priority) → Unknown
 *
 * @param rawType - Aircraft type string from data OR registration (e.g., "B777", "C-FXXX", "747-4R7")
 * @param mappings - Optional pre-loaded mappings (for performance in loops)
 * @returns Normalized type with confidence level and mapping ID
 */
export async function normalizeAircraftType(
  rawType: string | null | undefined,
  mappings?: AircraftTypeMapping[]
): Promise<NormalizedAircraftType> {
  // Handle null/empty
  if (!rawType || rawType.trim() === "") {
    return {
      canonical: "Unknown",
      raw: rawType ?? "",
      confidence: "fallback",
      mappingId: null,
    };
  }

  const cleaned = rawType.trim();
  const loadedMappings = mappings ?? (await loadMappings());

  // 1. Exact match (case-insensitive)
  const exactMatch = loadedMappings.find(
    (m) => m.pattern.toLowerCase() === cleaned.toLowerCase()
  );

  if (exactMatch) {
    return {
      canonical: exactMatch.canonicalType,
      raw: cleaned,
      confidence: "exact",
      mappingId: exactMatch.id,
    };
  }

  // 2. Pattern match (descending priority)
  // Supports wildcards: * (any chars), ? (single char)
  for (const mapping of loadedMappings) {
    if (matchesPattern(cleaned, mapping.pattern)) {
      return {
        canonical: mapping.canonicalType,
        raw: cleaned,
        confidence: "pattern",
        mappingId: mapping.id,
      };
    }
  }

  // 3. Fallback to Unknown
  return {
    canonical: "Unknown",
    raw: cleaned,
    confidence: "fallback",
    mappingId: null,
  };
}

/**
 * Pattern matching utility
 * Supports * (any chars) and ? (single char)
 */
function matchesPattern(input: string, pattern: string): boolean {
  // Convert pattern to regex
  // Escape special regex chars except * and ?
  const regexPattern = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // escape special chars
    .replace(/\*/g, ".*") // * → .*
    .replace(/\?/g, "."); // ? → .

  const regex = new RegExp(`^${regexPattern}$`, "i"); // case-insensitive
  return regex.test(input);
}

/**
 * Batch normalize (performance optimization for large datasets)
 */
export async function normalizeAircraftTypes(
  rawTypes: (string | null | undefined)[]
): Promise<NormalizedAircraftType[]> {
  const mappings = await loadMappings(); // Load once
  return Promise.all(rawTypes.map((raw) => normalizeAircraftType(raw, mappings)));
}
