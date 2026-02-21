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
    title: "Demand Allocations",
    description:
      "Contractual minimum hours per customer — guaranteed MH floors or additive allocations by shift and day-of-week.",
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
    title: "Model Assumptions",
    description:
      "Configure productivity factors (paid-to-available, available-to-productive, night factor), demand curve weights, and default MH.",
    href: "/admin/capacity/assumptions",
    icon: "fa-solid fa-sliders",
    color: "text-emerald-400",
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
