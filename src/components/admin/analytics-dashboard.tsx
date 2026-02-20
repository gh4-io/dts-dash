"use client";

import { useState, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { LoadingSkeleton } from "@/components/shared/loading-skeleton";
import { EmptyState } from "@/components/shared/empty-state";

interface AnalyticsSummary {
  activeUsers: number;
  pageViews: number;
  dataImports: number;
  errors: number;
  pageViewsByDay: Array<{ date: string; count: number }>;
  topPages: Array<{ page: string; count: number }>;
  eventsByType: Array<{ eventType: string; count: number }>;
}

interface EventsResponse {
  data: Array<{
    id: string;
    userId: string;
    eventType: string;
    eventData: string | null;
    page: string | null;
    createdAt: string;
  }>;
  meta: {
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
    hasMore: boolean;
  };
}

const KPI_CARDS = [
  { key: "activeUsers" as const, label: "Active Users", icon: "fa-users", color: "text-blue-500" },
  { key: "pageViews" as const, label: "Page Views", icon: "fa-eye", color: "text-green-500" },
  { key: "dataImports" as const, label: "Data Imports", icon: "fa-file-import", color: "text-purple-500" },
  { key: "errors" as const, label: "Errors", icon: "fa-triangle-exclamation", color: "text-red-500" },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatTimestamp(isoStr: string): string {
  const d = new Date(isoStr);
  return d.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

function formatPageName(page: string): string {
  // Strip leading slash, capitalize
  return page.replace(/^\//, "").replace(/-/g, " ") || "home";
}

export function AnalyticsDashboard() {
  const [timeRange, setTimeRange] = useState<"7d" | "30d">("7d");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [events, setEvents] = useState<EventsResponse | null>(null);
  const [eventsPage, setEventsPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchSummary = useCallback(async (range: string) => {
    try {
      const res = await fetch(`/api/analytics/summary?timeRange=${range}`);
      if (!res.ok) throw new Error("Failed to fetch summary");
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  const fetchEvents = useCallback(async (page: number) => {
    try {
      const res = await fetch(`/api/analytics/events?page=${page}&pageSize=20`);
      if (!res.ok) throw new Error("Failed to fetch events");
      return await res.json();
    } catch (err) {
      throw err;
    }
  }, []);

  // Fetch summary + events on mount and when timeRange changes
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);

    Promise.all([fetchSummary(timeRange), fetchEvents(1)])
      .then(([summaryData, eventsData]) => {
        if (cancelled) return;
        setSummary(summaryData);
        setEvents(eventsData);
        setEventsPage(1);
      })
      .catch((err) => {
        if (cancelled) return;
        setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [timeRange, fetchSummary, fetchEvents]);

  // Paginate events
  const handleEventsPage = useCallback(
    async (page: number) => {
      try {
        const data = await fetchEvents(page);
        setEvents(data);
        setEventsPage(page);
      } catch {
        // Silently fail pagination
      }
    },
    [fetchEvents]
  );

  if (loading) {
    return <LoadingSkeleton variant="page" />;
  }

  if (error) {
    return (
      <EmptyState
        icon="fa-triangle-exclamation"
        title="Failed to load analytics"
        message={error}
        action={{ label: "Retry", onClick: () => setTimeRange(timeRange), icon: "fa-rotate-right" }}
      />
    );
  }

  const isEmpty =
    summary &&
    summary.activeUsers === 0 &&
    summary.pageViews === 0 &&
    summary.dataImports === 0 &&
    summary.errors === 0;

  if (isEmpty) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
        </div>
        <EmptyState
          icon="fa-chart-bar"
          title="No analytics data yet"
          message="Events will appear as users interact with the app."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Time Range Selector */}
      <div className="flex items-center justify-between">
        <TimeRangeSelector value={timeRange} onChange={setTimeRange} />
      </div>

      {/* KPI Cards */}
      {summary && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {KPI_CARDS.map((card) => (
            <div
              key={card.key}
              className="rounded-lg border border-border bg-card p-4"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                <i className={`fa-solid ${card.icon} ${card.color}`} />
                {card.label}
              </div>
              <div className="text-2xl font-bold tabular-nums">
                {summary[card.key]}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Page Views Over Time */}
      {summary && summary.pageViewsByDay.length > 0 && (
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
            <i className="fa-solid fa-chart-area" />
            Page Views Over Time
          </h3>
          <ResponsiveContainer width="100%" height={250}>
            <AreaChart data={summary.pageViewsByDay} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
              <XAxis
                dataKey="date"
                tickFormatter={formatDate}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={{ stroke: "hsl(var(--border))" }}
              />
              <YAxis
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: 8,
                  color: "hsl(var(--popover-foreground))",
                  fontSize: 12,
                }}
                labelFormatter={(label) => formatDate(String(label))}
              />
              <Area
                type="monotone"
                dataKey="count"
                name="Page Views"
                stroke="hsl(var(--primary))"
                fill="hsl(var(--primary))"
                fillOpacity={0.15}
                strokeWidth={2}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Two Column: Top Pages + Events by Type */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
        {/* Top Pages - Bar Chart */}
        {summary && summary.topPages.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <i className="fa-solid fa-ranking-star" />
              Top Pages
            </h3>
            <ResponsiveContainer width="100%" height={Math.max(200, summary.topPages.length * 32)}>
              <BarChart
                data={summary.topPages}
                layout="vertical"
                margin={{ top: 0, right: 10, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} horizontal={false} />
                <XAxis
                  type="number"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={{ stroke: "hsl(var(--border))" }}
                  allowDecimals={false}
                />
                <YAxis
                  type="category"
                  dataKey="page"
                  tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 10 }}
                  tickLine={false}
                  axisLine={false}
                  width={120}
                  tickFormatter={formatPageName}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--popover))",
                    border: "1px solid hsl(var(--border))",
                    borderRadius: 8,
                    color: "hsl(var(--popover-foreground))",
                    fontSize: 12,
                  }}
                  labelFormatter={(label) => formatPageName(String(label))}
                />
                <Bar
                  dataKey="count"
                  name="Views"
                  fill="hsl(var(--primary))"
                  radius={[0, 4, 4, 0]}
                  barSize={20}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}

        {/* Events by Type - Table */}
        {summary && summary.eventsByType.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-4">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-3 flex items-center gap-2">
              <i className="fa-solid fa-layer-group" />
              Events by Type
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="pb-2 text-left text-xs font-medium text-muted-foreground">Event Type</th>
                    <th className="pb-2 text-right text-xs font-medium text-muted-foreground">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.eventsByType.map((e) => (
                    <tr key={e.eventType} className="border-b border-border/50">
                      <td className="py-2 font-mono text-xs">{e.eventType}</td>
                      <td className="py-2 text-right tabular-nums">{e.count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* Recent Events Table */}
      {events && events.data.length > 0 && (
        <div className="rounded-lg border border-border bg-card">
          <div className="p-4 border-b border-border">
            <h3 className="text-xs font-semibold uppercase text-muted-foreground flex items-center gap-2">
              <i className="fa-solid fa-clock-rotate-left" />
              Recent Events
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">User</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Event</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Page</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground">Details</th>
                </tr>
              </thead>
              <tbody>
                {events.data.map((event) => (
                  <tr key={event.id} className="border-b border-border/50">
                    <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">
                      {formatTimestamp(event.createdAt)}
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{event.userId.slice(0, 8)}</td>
                    <td className="px-4 py-2">
                      <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
                        {event.eventType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-xs">{event.page ?? "—"}</td>
                    <td className="px-4 py-2 text-xs text-muted-foreground max-w-[200px] truncate">
                      {event.eventData ?? "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {/* Pagination */}
          {events.meta.totalPages > 1 && (
            <div className="flex items-center justify-between p-3 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Page {events.meta.page} of {events.meta.totalPages} ({events.meta.total} events)
              </span>
              <div className="flex gap-1">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEventsPage(eventsPage - 1)}
                  disabled={eventsPage <= 1}
                >
                  <i className="fa-solid fa-chevron-left text-xs" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEventsPage(eventsPage + 1)}
                  disabled={!events.meta.hasMore}
                >
                  <i className="fa-solid fa-chevron-right text-xs" />
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TimeRangeSelector({
  value,
  onChange,
}: {
  value: "7d" | "30d";
  onChange: (v: "7d" | "30d") => void;
}) {
  return (
    <Select value={value} onValueChange={(v) => onChange(v as "7d" | "30d")}>
      <SelectTrigger className="w-[160px] h-9 text-xs">
        <i className="fa-solid fa-calendar-days mr-1.5 text-muted-foreground" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="7d">Last 7 days</SelectItem>
        <SelectItem value="30d">Last 30 days</SelectItem>
      </SelectContent>
    </Select>
  );
}
