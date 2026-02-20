"use client";

import { useEffect, useState } from "react";

interface FreshnessData {
  importedAt: string | null;
  ageHours: number | null;
}

export function DataFreshnessBadge() {
  const [data, setData] = useState<FreshnessData>({ importedAt: null, ageHours: null });

  useEffect(() => {
    fetch("/api/data-freshness")
      .then((res) => (res.ok ? res.json() : null))
      .then((json) => {
        if (json) setData(json);
      })
      .catch(() => {});
  }, []);

  if (!data.importedAt) {
    return (
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <i className="fa-solid fa-clock-rotate-left" />
        No import data
      </span>
    );
  }

  const age = data.ageHours ?? 0;
  let statusColor = "text-emerald-500"; // green: <24h
  let dotColor = "bg-emerald-500";
  if (age > 72) {
    statusColor = "text-red-500";
    dotColor = "bg-red-500";
  } else if (age > 24) {
    statusColor = "text-amber-500";
    dotColor = "bg-amber-500";
  }

  const fmtDate = new Date(data.importedAt).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  });
  const fmtTime = new Date(data.importedAt).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });

  return (
    <span className={`inline-flex items-center gap-1.5 text-xs ${statusColor}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${dotColor}`} />
      <i className="fa-solid fa-clock-rotate-left" />
      Last import: {fmtDate} {fmtTime} UTC
    </span>
  );
}
