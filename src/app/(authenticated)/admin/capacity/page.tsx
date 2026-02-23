"use client";

import Link from "next/link";

const CAPACITY_SECTIONS = [
  {
    title: "Staffing Matrix",
    description:
      "Advanced rotation-based staffing with 3-week cycles, custom shift definitions, and weekly headcount visualization.",
    href: "/admin/capacity/staffing",
    icon: "fa-solid fa-calendar-days",
    color: "text-violet-400",
  },
  {
    title: "Headcount Plans",
    description:
      "Manage base headcount per shift with effective dating, weekday overrides, and date-specific exceptions.",
    href: "/admin/capacity/headcount",
    icon: "fa-solid fa-users",
    color: "text-blue-400",
  },
  {
    title: "Demand Contracts",
    description:
      "Named customer contracts with scheduled allocation lines — contractual MH floors or additive allocations by shift and day-of-week.",
    href: "/admin/capacity/allocations",
    icon: "fa-solid fa-handshake",
    color: "text-amber-400",
  },
  {
    title: "Flight Events",
    description:
      "Track scheduled and actual aircraft arrivals/departures with coverage windows for guaranteed capacity periods.",
    href: "/admin/capacity/flight-events",
    icon: "fa-solid fa-plane-arrival",
    color: "text-sky-400",
  },
  {
    title: "Rate Forecasts",
    description:
      "Project future demand based on historical patterns using moving average, weighted average, or linear trend models.",
    href: "/admin/capacity/rate-forecasts",
    icon: "fa-solid fa-chart-line",
    color: "text-teal-400",
  },
  {
    title: "Worked Hours",
    description:
      "Track actual man-hours per task \u2014 routine, non-routine, AOG, training, admin \u2014 with planned vs actual variance analysis.",
    href: "/admin/capacity/time-bookings",
    icon: "fa-solid fa-stopwatch",
    color: "text-green-400",
  },
  {
    title: "Billed Hours",
    description:
      "Track invoiced/billable man-hours per customer and aircraft for revenue reconciliation against worked hours and planned demand.",
    href: "/admin/capacity/billing-entries",
    icon: "fa-solid fa-file-invoice-dollar",
    color: "text-indigo-400",
  },
  {
    title: "Model Assumptions",
    description:
      "Configure productivity factors (paid-to-available, available-to-productive, night factor), demand curve weights, and default MH.",
    href: "/admin/capacity/assumptions",
    icon: "fa-solid fa-sliders",
    color: "text-emerald-400",
  },
  {
    title: "Weekly Projections",
    description:
      "Assumed customer MH targets per day-of-week and shift. Pink overlay on the Typical Week Pattern chart. Temporary reference feature.",
    href: "/admin/capacity/weekly-projections",
    icon: "fa-solid fa-bullseye",
    color: "text-pink-400",
    badge: "TEMP",
  },
  {
    title: "Dev Overview",
    description:
      "Inspect intermediate pipeline values — assumptions, formula trace, daily numbers, WP contributions, and raw data. Admin debug tool.",
    href: "/admin/capacity/dev-overview",
    icon: "fa-solid fa-bug",
    color: "text-amber-400",
    badge: "DEV",
  },
];

export default function AdminCapacityPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="text-sm text-muted-foreground">
          Configure capacity modeling parameters. Changes affect how the Capacity Modeling page
          computes demand, capacity, and utilization.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {CAPACITY_SECTIONS.map((section) => (
          <Link
            key={section.href}
            href={section.href}
            className="group rounded-lg border border-border bg-card p-5 hover:border-primary/50 hover:bg-accent/30 transition-all"
          >
            <div className="flex items-start gap-3">
              <div
                className={`rounded-md border border-border bg-muted p-2.5 ${section.color} group-hover:scale-105 transition-transform`}
              >
                <i className={`${section.icon} text-lg`} />
              </div>
              <div className="space-y-1 min-w-0">
                <h3 className="text-sm font-semibold group-hover:text-primary transition-colors">
                  {section.title}
                  {"badge" in section && section.badge && (
                    <span className="rounded-full bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[9px] font-bold text-amber-400 ml-1.5 align-middle">
                      {section.badge}
                    </span>
                  )}
                  <i className="fa-solid fa-arrow-right text-[10px] ml-1.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {section.description}
                </p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {/* Info card about the capacity model */}
      <div className="rounded-lg border border-blue-500/20 bg-blue-500/5 p-4 space-y-2">
        <div className="flex items-center gap-2 text-sm font-medium text-blue-400">
          <i className="fa-solid fa-circle-info" />
          About the Capacity Model
        </div>
        <div className="text-xs text-muted-foreground space-y-1.5 leading-relaxed">
          <p>
            The capacity model uses a <strong>3-tier productivity chain</strong> to convert
            headcount into productive man-hours:
          </p>
          <p className="font-mono text-[11px] text-foreground bg-muted/50 rounded px-2 py-1">
            Paid Hours x Paid-to-Available x Available-to-Productive x Night Factor = Productive
            MH/person
          </p>
          <p>
            Demand is <strong>distributed</strong> across ground-time shift slots (not duplicated
            per day). A work package with 6 MH over 3 shifts allocates 2 MH per slot.
          </p>
          <p>
            All factors are configurable. View the{" "}
            <Link href="/capacity" className="text-blue-400 hover:underline">
              Capacity Modeling
            </Link>{" "}
            page to see the results.
          </p>
        </div>
      </div>
    </div>
  );
}
