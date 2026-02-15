/**
 * HTML tooltip formatter for flight board Gantt bars
 */
export function formatFlightTooltip(data: {
  registration: string;
  aircraftType: string;
  customer: string;
  customerColor: string;
  flightId: string | null;
  arrival: string;
  departure: string;
  groundHours: number;
  status: string;
  workpackageNo: string | null;
  effectiveMH: number;
  mhSource: string;
  comments: string | null;
  timezone?: string;
  timeFormat?: "12h" | "24h";
}): string {
  const groundH = Math.floor(data.groundHours);
  const groundM = Math.round((data.groundHours - groundH) * 60);
  const groundStr = `${groundH}h ${groundM}m`;

  const tz = data.timezone ?? "UTC";
  const arrivalDate = new Date(data.arrival);
  const departureDate = new Date(data.departure);

  // Get timezone abbreviation (e.g., "UTC", "EST", "EDT")
  const tzLabel = tz === "UTC"
    ? "UTC"
    : new Intl.DateTimeFormat("en-US", { timeZone: tz, timeZoneName: "short" })
        .formatToParts(arrivalDate)
        .find((p) => p.type === "timeZoneName")?.value ?? "ET";

  const use12h = data.timeFormat === "12h";
  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz }) +
    ", " +
    d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: use12h, timeZone: tz }) +
    ` ${tzLabel}`;

  const mhLabel =
    data.mhSource === "manual"
      ? "override"
      : data.mhSource === "workpackage"
        ? "WP"
        : "default";

  // Use CSS variables for theme-aware colors
  const dimColor = "hsl(var(--muted-foreground))";
  const borderColor = "hsl(var(--border))";
  const fgColor = "hsl(var(--popover-foreground))";

  const commentsHtml = data.comments
    ? `<div style="border-top:1px solid ${borderColor};padding-top:6px;margin-top:6px;font-style:italic;font-size:11px;color:${dimColor};">"${data.comments.slice(0, 100)}${data.comments.length > 100 ? "..." : ""}"</div>`
    : "";

  return `
<div style="padding:10px 12px;max-width:320px;font-size:12px;line-height:1.5;color:${fgColor};">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="display:flex;flex-direction:column;gap:2px;">
      <span style="font-size:14px;font-weight:bold;">${data.registration}</span>
      <span style="font-size:11px;color:${dimColor};">${data.aircraftType}</span>
    </div>
    <span style="display:flex;align-items:center;gap:5px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${data.customerColor};display:inline-block;"></span>
      ${data.customer}
    </span>
  </div>
  <div style="border-top:1px solid ${borderColor};padding-top:6px;">
    ${data.flightId ? `<div><span style="color:${dimColor};">Flight:</span> ${data.flightId}</div>` : ""}
    <div><span style="color:${dimColor};">Arrival:</span> ${fmtDate(arrivalDate)}</div>
    <div><span style="color:${dimColor};">Departure:</span> ${fmtDate(departureDate)}</div>
    <div><span style="color:${dimColor};">Ground:</span> ${groundStr}</div>
  </div>
  <div style="border-top:1px solid ${borderColor};padding-top:6px;margin-top:6px;">
    <div><span style="color:${dimColor};">Status:</span> ${data.status}</div>
    <div><span style="color:${dimColor};">WP #:</span> ${data.workpackageNo ?? "—"}</div>
    <div><span style="color:${dimColor};">Man-Hours:</span> ${data.effectiveMH} MH (${mhLabel})</div>
  </div>
  ${commentsHtml}
  <div style="margin-top:6px;font-size:11px;color:${dimColor};">Click for full details →</div>
</div>`.trim();
}
