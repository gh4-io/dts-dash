"use client";

interface AggregationToggleProps {
  value: "daily" | "weekly-pattern" | "monthly";
  onChange: (v: "daily" | "weekly-pattern" | "monthly") => void;
}

const OPTIONS: { value: AggregationToggleProps["value"]; label: string; icon: string }[] = [
  { value: "daily", label: "Daily", icon: "fa-solid fa-calendar-day" },
  { value: "weekly-pattern", label: "Weekly Pattern", icon: "fa-solid fa-calendar-week" },
  { value: "monthly", label: "Monthly", icon: "fa-solid fa-calendar" },
];

export function AggregationToggle({ value, onChange }: AggregationToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">
        View
      </span>
      <div className="flex items-center gap-1 rounded-md border border-border p-0.5">
        {OPTIONS.map((opt) => {
          const isActive = value === opt.value;
          return (
            <button
              key={opt.value}
              className={`flex items-center gap-1 px-2 py-0.5 text-[10px] rounded transition-colors ${
                isActive
                  ? "bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`}
              onClick={() => onChange(opt.value)}
            >
              <i className={`${opt.icon} text-[9px]`} />
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
