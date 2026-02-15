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

  const commentsHtml = data.comments
    ? `<div style="border-top:1px solid rgba(255,255,255,0.15);padding-top:6px;margin-top:6px;font-style:italic;font-size:11px;color:rgba(255,255,255,0.7);">"${data.comments.slice(0, 100)}${data.comments.length > 100 ? "..." : ""}"</div>`
    : "";

  return `
<div style="padding:10px 12px;max-width:320px;font-size:12px;line-height:1.5;">
  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
    <div style="display:flex;flex-direction:column;gap:2px;">
      <span style="font-size:14px;font-weight:bold;">${data.registration}</span>
      <span style="font-size:11px;color:rgba(255,255,255,0.6);">${data.aircraftType}</span>
    </div>
    <span style="display:flex;align-items:center;gap:5px;">
      <span style="width:8px;height:8px;border-radius:50%;background:${data.customerColor};display:inline-block;"></span>
      ${data.customer}
    </span>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,0.15);padding-top:6px;">
    ${data.flightId ? `<div><span style="color:rgba(255,255,255,0.6);">Flight:</span> ${data.flightId}</div>` : ""}
    <div><span style="color:rgba(255,255,255,0.6);">Arrival:</span> ${fmtDate(arrivalDate)}</div>
    <div><span style="color:rgba(255,255,255,0.6);">Departure:</span> ${fmtDate(departureDate)}</div>
    <div><span style="color:rgba(255,255,255,0.6);">Ground:</span> ${groundStr}</div>
  </div>
  <div style="border-top:1px solid rgba(255,255,255,0.15);padding-top:6px;margin-top:6px;">
    <div><span style="color:rgba(255,255,255,0.6);">Status:</span> ${data.status}</div>
    <div><span style="color:rgba(255,255,255,0.6);">WP #:</span> ${data.workpackageNo ?? "—"}</div>
    <div><span style="color:rgba(255,255,255,0.6);">Man-Hours:</span> ${data.effectiveMH} MH (${mhLabel})</div>
  </div>
  ${commentsHtml}
  <div style="margin-top:6px;font-size:11px;color:rgba(255,255,255,0.4);">Click for full details →</div>
</div>`.trim();
}
