"use client";

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useCustomers } from "@/lib/hooks/use-customers";
import { useFilters } from "@/lib/hooks/use-filters";
import type { SerializedWorkPackage } from "@/lib/hooks/use-work-packages";

interface FlightDetailDrawerProps {
  wp: SerializedWorkPackage | null;
  open: boolean;
  onClose: () => void;
}

export function FlightDetailDrawer({ wp, open, onClose }: FlightDetailDrawerProps) {
  const { getColor } = useCustomers();
  const { setOperators, setAircraft } = useFilters();

  if (!wp) return null;

  const arrival = new Date(wp.arrival);
  const departure = new Date(wp.departure);
  const groundH = Math.floor(wp.groundHours);
  const groundM = Math.round((wp.groundHours - groundH) * 60);

  const fmtDate = (d: Date) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      timeZone: "UTC",
    }) +
    " " +
    d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "UTC",
    }) +
    " UTC";

  const mhLabel =
    wp.mhSource === "manual"
      ? "Override"
      : wp.mhSource === "workpackage"
        ? "WP MH"
        : `Default (TotalMH ${wp.totalMH === null ? "null" : wp.totalMH})`;

  const color = getColor(wp.customer);

  return (
    <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
      <SheetContent className="w-[400px] overflow-y-auto sm:w-[440px]">
        <SheetHeader>
          <SheetTitle>Work Package Detail</SheetTitle>
        </SheetHeader>

        <div className="mt-4 space-y-4">
          {/* Aircraft Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Aircraft</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="Registration" value={wp.aircraftReg} bold />
              <Row label="Customer">
                <span className="flex items-center gap-1.5">
                  <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {wp.customer}
                </span>
              </Row>
              <Row label="Type" value={`${wp.inferredType} (inferred)`} />
              <button
                className="text-xs text-primary hover:underline"
                onClick={() => {
                  setAircraft([wp.aircraftReg]);
                  onClose();
                }}
              >
                → View all {wp.aircraftReg} work packages
              </button>
            </div>
          </section>

          <Separator />

          {/* Schedule Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Schedule</h3>
            <div className="space-y-1.5 text-sm">
              {wp.flightId && <Row label="Flight ID" value={wp.flightId} />}
              <Row label="Arrival" value={fmtDate(arrival)} />
              <Row label="Departure" value={fmtDate(departure)} />
              <Row label="Ground Time" value={`${groundH}h ${groundM}m`} />
              <Row label="Status">
                <Badge variant="secondary" className="text-xs">{wp.status}</Badge>
              </Row>
            </div>
          </section>

          <Separator />

          {/* Work Package Section */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Work Package</h3>
            <div className="space-y-1.5 text-sm">
              <Row label="WP Number" value={wp.workpackageNo ?? "—"} />
              <Row label="Has WP">
                <Badge variant={wp.hasWorkpackage ? "default" : "secondary"} className="text-xs">
                  {wp.hasWorkpackage ? "Yes" : "No"}
                </Badge>
              </Row>
              <Row label="Man-Hours" value={`${wp.effectiveMH} MH`} />
              <Row label="MH Source" value={mhLabel} />
            </div>
          </section>

          {wp.calendarComments && (
            <>
              <Separator />
              <section>
                <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Notes</h3>
                <p className="text-sm italic text-muted-foreground">
                  &ldquo;{wp.calendarComments}&rdquo;
                </p>
              </section>
            </>
          )}

          <Separator />

          {/* Linked Information */}
          <section>
            <h3 className="text-xs font-semibold uppercase text-muted-foreground mb-2">Linked Information</h3>
            <div className="space-y-1.5">
              <LinkButton
                label={`All ${wp.aircraftReg} visits`}
                onClick={() => {
                  setAircraft([wp.aircraftReg]);
                  onClose();
                }}
              />
              <LinkButton
                label={`All ${wp.customer} work packages`}
                onClick={() => {
                  setOperators([wp.customer]);
                  onClose();
                }}
              />
            </div>
          </section>

          {/* Metadata footer */}
          <div className="pt-2 text-xs text-muted-foreground">
            ID: {wp.id} · Document Set: {wp.documentSetId}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Row({
  label,
  value,
  bold,
  children,
}: {
  label: string;
  value?: string;
  bold?: boolean;
  children?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <span className="text-muted-foreground shrink-0">{label}</span>
      {children ?? <span className={bold ? "font-semibold" : ""}>{value}</span>}
    </div>
  );
}

function LinkButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      className="block text-xs text-primary hover:underline"
      onClick={onClick}
    >
      → {label}
    </button>
  );
}
