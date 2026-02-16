/**
 * Fuzzy String Matching
 * Uses Levenshtein distance + normalization for operator FK lookups
 */

import type { Customer } from "@/types";

export interface FuzzyMatchResult {
  customerId: string;
  customerName: string;
  confidence: number; // 0-100
  matched: boolean;
}

/**
 * Calculate Levenshtein distance between two strings
 * Returns the minimum number of single-character edits required
 */
function levenshteinDistance(a: string, b: string): number {
  const matrix: number[][] = [];

  // Initialize matrix
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }

  // Fill matrix
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b.charAt(i - 1) === a.charAt(j - 1)) {
        matrix[i][j] = matrix[i - 1][j - 1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i - 1][j - 1] + 1, // substitution
          matrix[i][j - 1] + 1, // insertion
          matrix[i - 1][j] + 1 // deletion
        );
      }
    }
  }

  return matrix[b.length][a.length];
}

/**
 * Normalize customer name for matching
 * - Lowercase
 * - Collapse whitespace
 * - Remove common suffixes (Inc, Ltd, LLC, Corp)
 * - Remove punctuation
 */
function normalizeCustomerName(name: string): string {
  return name
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ") // Collapse whitespace
    .replace(/\b(inc|ltd|llc|corp|corporation|limited)\b\.?/g, "") // Remove suffixes
    .replace(/[^\w\s]/g, "") // Remove punctuation
    .trim();
}

/**
 * Fuzzy match operator string to customer in database
 * Returns best match with confidence score (0-100)
 * Minimum 70% confidence required for match
 */
export function fuzzyMatchCustomer(
  rawOperator: string,
  customers: Customer[]
): FuzzyMatchResult {
  if (!rawOperator || customers.length === 0) {
    return {
      customerId: "",
      customerName: rawOperator,
      confidence: 0,
      matched: false,
    };
  }

  const normalized = normalizeCustomerName(rawOperator);

  // 1. Exact match (after normalization)
  const exact = customers.find(
    (c) => normalizeCustomerName(c.name) === normalized
  );
  if (exact) {
    return {
      customerId: exact.id,
      customerName: exact.name,
      confidence: 100,
      matched: true,
    };
  }

  // 2. Calculate Levenshtein distance for all customers
  const distances = customers.map((c) => ({
    customer: c,
    distance: levenshteinDistance(normalized, normalizeCustomerName(c.name)),
  }));

  // 3. Find best match (lowest distance)
  const best = distances.sort((a, b) => a.distance - b.distance)[0];

  if (!best) {
    return {
      customerId: "",
      customerName: rawOperator,
      confidence: 0,
      matched: false,
    };
  }

  // 4. Calculate confidence (lower distance = higher confidence)
  const maxLen = Math.max(
    normalized.length,
    normalizeCustomerName(best.customer.name).length
  );
  const confidence = Math.round((1 - best.distance / maxLen) * 100);

  // 5. Require minimum 70% confidence for match
  if (confidence >= 70) {
    return {
      customerId: best.customer.id,
      customerName: best.customer.name,
      confidence,
      matched: true,
    };
  }

  // 6. No good match found
  return {
    customerId: "",
    customerName: rawOperator,
    confidence,
    matched: false,
  };
}
