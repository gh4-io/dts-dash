import fs from "fs";
import path from "path";
import type { SharePointWorkPackage } from "@/types";

/**
 * Work Package Reader
 * Reads and parses data/input.json (OData format from SharePoint)
 * Implements module-level caching with invalidation flag
 */

let cachedData: SharePointWorkPackage[] | null = null;
let shouldInvalidate = false;

/**
 * Read work packages from data/input.json
 * Returns cached data if available, re-reads on invalidation
 */
export function readWorkPackages(): SharePointWorkPackage[] {
  if (cachedData && !shouldInvalidate) {
    return cachedData;
  }

  const dataPath = path.join(process.cwd(), "data", "input.json");

  if (!fs.existsSync(dataPath)) {
    console.warn(`[reader] data/input.json not found at ${dataPath}`);
    cachedData = [];
    shouldInvalidate = false;
    return [];
  }

  try {
    const raw = fs.readFileSync(dataPath, "utf-8");
    const parsed = JSON.parse(raw);

    // Handle both OData format { value: [...] } and bare array [...]
    const records: SharePointWorkPackage[] = Array.isArray(parsed)
      ? parsed
      : parsed.value ?? [];

    cachedData = records;
    shouldInvalidate = false;

    console.warn(`[reader] Loaded ${records.length} work packages from input.json`);
    return records;
  } catch (error) {
    console.error("[reader] Failed to read or parse input.json:", error);
    cachedData = [];
    shouldInvalidate = false;
    return [];
  }
}

/**
 * Invalidate the cache (e.g., after a new import)
 * Next call to readWorkPackages() will re-read from disk
 */
export function invalidateCache(): void {
  shouldInvalidate = true;
  console.warn("[reader] Cache invalidated");
}

/**
 * Get current cache status (for debugging/admin)
 */
export function getCacheStatus(): {
  isCached: boolean;
  recordCount: number;
  willInvalidate: boolean;
} {
  return {
    isCached: cachedData !== null,
    recordCount: cachedData?.length ?? 0,
    willInvalidate: shouldInvalidate,
  };
}
