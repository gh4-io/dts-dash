# REQ: Data Sources

## Primary Source: SharePoint OData Export

- **File**: `data/input.json` (copied from `.claude/assets/input.json`)
- **Origin**: `https://kalittaair.sharepoint.com/sites/CVG145Scheduling/_api/`
- **Records**: 86 work packages
- **Date range**: Feb 7–23, 2026
- **Format**: OData JSON with `{ "odata.metadata": "...", "value": [...] }`

### Field Summary
See [REQ_DataModel.md](REQ_DataModel.md) for full TypeScript interfaces.

### Key Statistics
| Metric | Value |
|--------|-------|
| Total records | 86 |
| Unique aircraft | 57 |
| Unique customers | 6 |
| Records with TotalMH | 20/86 |
| Records with HasWorkpackage=true | 27/86 |
| Records with FlightId | 76/86 |
| Avg ground hours | 16.2h |
| Max ground hours | 53.2h |
| Status: New | 63 |
| Status: Approved | 23 |

## API Routes

### `GET /api/work-packages`
**Params**: `?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV&status=New|Approved&page=1&pageSize=30`
**Response**: `PaginatedResponse<WorkPackage>` (see [REQ_DataModel.md](REQ_DataModel.md))
**Filter logic**: `departure > start AND arrival < end AND customer IN ops AND reg IN ac AND type IN types`
**Pagination** (D-017): Default page=1, pageSize=30. Max pageSize=200. Omit pagination params to get all records (for chart/Gantt consumers).

### `GET /api/work-packages/all`
**Params**: `?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV`
**Response**: `{ data: WorkPackage[], meta: { total: number } }`
**Purpose**: Unpaginated endpoint for Gantt/chart consumers that need the full filtered dataset. Table views use the paginated endpoint above.

### `GET /api/hourly-snapshots`
**Params**: `?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV`
**Response**: `{ snapshots: HourlySnapshot[] }`
**Note**: Always returns full dataset (no pagination — these are pre-aggregated time-series points).

### `GET /api/capacity`
**Params**: `?start=ISO&end=ISO&op=CSV&ac=CSV&type=CSV`
**Response**: `{ demand: DailyDemand[], capacity: DailyCapacity[], utilization: DailyUtilization[] }`
Note: Filters affect demand only; capacity depends on shift config. No pagination (daily aggregates).

### `GET/PUT /api/config`
**GET**: `{ config: AppConfig }`
**PUT body**: `Partial<AppConfig>` → **Response**: `{ config: AppConfig }`

### Pagination Convention (D-017)

All list endpoints support optional pagination via `page` and `pageSize` query params:
- `page`: 1-based page number (default: 1)
- `pageSize`: records per page (default: 30, max: 200, configurable per user via `tablePageSize` preference)
- Omitting both returns all records (backward-compatible for chart/Gantt consumers)
- Response always includes `meta.total` and `meta.totalPages` for UI page controls
- Table views (capacity detail, admin lists) use pagination by default
- Chart/Gantt endpoints (`/api/hourly-snapshots`, `/api/work-packages/all`) never paginate

---

## HAR File Analysis

### airways.cargojet.com.har (Flight Board — APEX Page 92)

**Source**: `/.claude/airways.cargojet.com.har` (5.6MB)

#### Filter Fields (POST to wwv_flow.ajax)
| Field | Label | Type | Example |
|-------|-------|------|---------|
| P92_STRDAT | "Start Date" | datetime | `13-FEB-2026+09:28` |
| P92_ENDDAT | "End Date" | datetime | `15-FEB-2026+03:28` |
| P92_ARPCOD | "Airport" | select | `""` (blank = all) |
| P92_UTCLCL | "UTC/Local Time" | select | `"LOCAL"` or `"UTC"` |

#### Gantt Response Structure
```json
{
  "start": "2026-02-13T09:28:00.000",
  "end": "2026-02-15T03:28:00.000",
  "viewportStart": "2026-02-13T09:28:00.000",
  "viewportEnd": "2026-02-15T03:28:00.000",
  "rows": [
    {
      "id": "500",
      "label": "500-GIAJ",
      "tasks": [
        {
          "id": "13697416",
          "start": "2026-02-13T23:05:00",
          "end": "2026-02-14T04:30:00",
          "label": "YYC 584 YHM",
          "customTooltip": "Flight #: 584\nTail #: 501-FKCJ\nLeg : YYC-YHM\nSch Departure(L): 13-Feb-2026 23:05\nSch Arrival(L): 14-Feb-2026 04:30\nStatus: SCHEDULED",
          "svgClassName": "demo-f-green"
        }
      ]
    }
  ]
}
```

- **41 rows** (aircraft), **99 tasks** (flights)
- **Statuses**: SCHEDULED, NEW-FLIGHT, ARRIVED, DEPARTED
- **Colors**: `demo-f-green` (scheduled), `demo-f-departed` (departed)
- **Fleet numbering**: `NNN-RRRR` (e.g., `506-GTCJ` = registration C-GTCJ)

### airways.cargojet.com_search_filter.har (Tasks — APEX Page 45)

**Source**: `/.claude/airways.cargojet.com_search_filter.har` (5.9MB)

#### Navigation Structure (14 items)
| Page | Label |
|------|-------|
| 92 | Flight Display |
| 40 | Status |
| 45 | Tasks |
| 14 | Defects |
| 32 | Materials |
| 72 | Part Inquiry |
| 1415 | COMAT |
| 95 | Rotables |
| 98 | Wheels |
| 54 | Parts Issue |
| 83 | Re-Stock |
| 94 | PO Paperwork |
| 38 | Reports |

#### Task Grid Columns
Scheduled, Fleet #, Task ID, WC #, Defect Description, Action Required, Station, Department, Close Task, Status, Created By, Ship To Base

#### Key Findings
- **Station always "CVG"** → confirms locked-station design (D-002)
- **49 open tasks** across 16 aircraft visits
- **Department**: Always "Line Maintenance"
- Tasks grouped by Scheduled Date + Fleet #

### What's NOT in the HAR files
- No endpoint for operator/customer filtering (CargoJet uses sidebar nav)
- No aircraft type filtering visible
- No pagination parameters observed
- No authentication tokens captured (session-based)

These gaps are noted in [OPEN_ITEMS.md](../OPEN_ITEMS.md).
