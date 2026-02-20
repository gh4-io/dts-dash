# Phase 2 — Testing

**Date:** 2026-02-15

## Test Framework

| Component | Choice |
|-----------|--------|
| Runner | Vitest 4.0 |
| Environment | jsdom |
| React Testing | @testing-library/react |
| DOM Matchers | @testing-library/jest-dom |
| Config | `vitest.config.ts` |
| Setup | `src/test/setup.ts` |

## Test Suite

### `src/lib/utils/__tests__/date-helpers.test.ts` (24 tests)

| Group | Tests | Covers |
|-------|-------|--------|
| formatDuration | 5 | Whole hours, fractions, zero, NaN/Infinity, padding |
| formatDurationHuman | 4 | Hours+minutes, hours-only, minutes-only, zero |
| toISO / fromISO | 2 | Round-trip, format verification |
| addDays / subtractDays | 4 | Add, subtract, immutability, month boundaries |
| isSameDay | 2 | Same day (different times), different days |
| roundToHour | 2 | Rounding, immutability |
| formatDateRange | 3 | Same day, same month, different months |
| formatInTimezone | 2 | UTC format, Eastern timezone offset |

### `src/lib/utils/__tests__/pagination.test.ts` (12 tests)

| Group | Tests | Covers |
|-------|-------|--------|
| paginate | 8 | Default page, specific page, last page, page clamping (low/high), pageSize clamping (low/high), empty array, single item |
| parsePaginationParams | 3 | Valid params, missing params, NaN strings |

### `src/lib/utils/__tests__/contrast.test.ts` (13 tests)

| Group | Tests | Covers |
|-------|-------|--------|
| isValidHex | 6 | Valid formats, invalid (no hash, 3-digit, bad chars, wrong length) |
| relativeLuminance | 3 | White=1, black=0, mid-grey |
| contrastRatio | 3 | Black/white=21:1, same=1:1, commutativity |
| getContrastText | 2 | White for dark bg, black for light bg |
| getWCAGLevel | 3 | AAA, Fail, AA |

### `src/lib/utils/__tests__/csv-export.test.ts` (2 tests)

| Group | Tests | Covers |
|-------|-------|--------|
| exportToCsv | 2 | Download trigger with correct filename, no-op for empty data |

## Coverage Gaps (Future)

| Area | Priority | Notes |
|------|----------|-------|
| filter-helpers.ts | HIGH | parseFilterParams, applyFilters, validateFilterState |
| data-transforms.ts | HIGH | evaluateCondition, applySorts, applyColumnFilters |
| capacity.ts engine | MEDIUM | computeDailyDemand, computeDailyCapacity, computeDailyUtilization |
| hourly-snapshot.ts engine | MEDIUM | computeHourlySnapshots |
| aircraft-type.ts | MEDIUM | normalizeAircraftType, matchesPattern |
| API route handlers | LOW | Integration tests with mocked DB |
| React components | LOW | Render tests with Testing Library |

## Running Tests

```bash
npm run test          # Run once
npm run test:watch    # Watch mode
npm run test:coverage # With coverage report
npm run validate      # Full pipeline (typecheck + lint + test + build)
```
