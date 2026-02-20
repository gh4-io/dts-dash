import type { PaginationParams, PaginatedResponse } from "@/types";

/**
 * Pagination Utility (D-017)
 * Paginates arrays with validation and metadata
 */

const MIN_PAGE_SIZE = 1;
const MAX_PAGE_SIZE = 200;
const DEFAULT_PAGE_SIZE = 30;

/**
 * Paginate an array of items
 * Validates bounds: page >= 1, pageSize 1-200
 *
 * @param items - Array to paginate
 * @param params - Pagination parameters (page, pageSize)
 * @returns Paginated response with data and metadata
 */
export function paginate<T>(items: T[], params?: PaginationParams): PaginatedResponse<T> {
  const total = items.length;

  // Validate and apply defaults
  let page = params?.page ?? 1;
  let pageSize = params?.pageSize ?? DEFAULT_PAGE_SIZE;

  // Clamp page to valid range
  if (page < 1) {
    page = 1;
  }

  // Clamp pageSize to valid range
  if (pageSize < MIN_PAGE_SIZE) {
    pageSize = MIN_PAGE_SIZE;
  }
  if (pageSize > MAX_PAGE_SIZE) {
    pageSize = MAX_PAGE_SIZE;
  }

  // Calculate pagination
  const totalPages = Math.ceil(total / pageSize);

  // Clamp page to actual pages available
  if (page > totalPages && totalPages > 0) {
    page = totalPages;
  }

  const startIndex = (page - 1) * pageSize;
  const endIndex = startIndex + pageSize;

  const data = items.slice(startIndex, endIndex);
  const hasMore = endIndex < total;

  return {
    data,
    meta: {
      total,
      page,
      pageSize,
      totalPages,
      hasMore,
    },
  };
}

/**
 * Parse pagination params from query string
 * Converts string values to numbers
 */
export function parsePaginationParams(query: URLSearchParams): PaginationParams {
  const page = query.get("page");
  const pageSize = query.get("pageSize");

  return {
    page: page ? parseInt(page, 10) : undefined,
    pageSize: pageSize ? parseInt(pageSize, 10) : undefined,
  };
}
