"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { FlightEventEditor } from "./flight-events-editor";
import type { FlightEvent } from "@/types";

function formatDatetime(dt: string | null): string {
  if (!dt) return "—";
  const d = new Date(dt);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  });
}

/** "12345.." → "Mon–Fri"  |  "1......" → "Mon"  |  ".....67" → "Sat–Sun" */
function formatDayPattern(pattern: string | null): string {
  if (!pattern) return "";
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const active = days.filter((_, i) => pattern[i] !== ".");
  if (active.length === 0) return "";
  if (active.length === 1) return active[0];
  if (active.length === 7) return "Daily";
  if (pattern === "12345..") return "Mon–Fri";
  if (pattern === ".....67") return "Sat–Sun";
  // Check if contiguous
  const first = days.indexOf(active[0]);
  const last = days.indexOf(active[active.length - 1]);
  if (last - first + 1 === active.length) {
    return active[0] + "–" + active[active.length - 1];
  }
  return active.join(", ");
}

const STATUS_STYLES: Record<string, string> = {
  planned: "border-amber-500/50 text-amber-500",
  scheduled: "border-blue-500/50 text-blue-500",
  actual: "border-emerald-500/50 text-emerald-500",
  cancelled: "border-muted-foreground/50 text-muted-foreground",
};

const SOURCE_STYLES: Record<string, string> = {
  work_package: "border-violet-500/50 text-violet-500",
  manual: "border-slate-400/50 text-slate-400",
  import: "border-amber-500/50 text-amber-500",
};

interface FlightEventsGridProps {
  events: FlightEvent[];
  onCreate: (data: Omit<FlightEvent, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: number, updates: Partial<FlightEvent>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function FlightEventsGrid({ events, onCreate, onUpdate, onDelete }: FlightEventsGridProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<FlightEvent | null>(null);

  const handleAdd = () => {
    setEditingEvent(null);
    setEditorOpen(true);
  };

  const handleEdit = (event: FlightEvent) => {
    setEditingEvent(event);
    setEditorOpen(true);
  };

  const handleSave = async (data: Omit<FlightEvent, "id" | "createdAt" | "updatedAt">) => {
    if (editingEvent) {
      await onUpdate(editingEvent.id, data);
    } else {
      await onCreate(data);
    }
    setEditorOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Flight Events</h2>
          <p className="text-xs text-muted-foreground">
            {events.length} event{events.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <i className="fa-solid fa-plus mr-1.5" />
          Add Event
        </Button>
      </div>

      {events.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <i className="fa-solid fa-plane-arrival text-3xl text-muted-foreground/50 mb-3 block" />
          <p className="text-sm text-muted-foreground">No flight events configured.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add events to track aircraft arrivals and departures with coverage windows.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Aircraft / Flight No.</TableHead>
                <TableHead className="w-16">Repeat</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Sched Arr</TableHead>
                <TableHead>Sched Dep</TableHead>
                <TableHead>Windows</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {events.map((event) => (
                <TableRow key={event.id} className={!event.isActive ? "opacity-50" : ""}>
                  <TableCell className="font-mono text-sm font-medium">
                    {event.aircraftReg ?? (
                      <span className="text-muted-foreground italic text-xs">—</span>
                    )}
                  </TableCell>
                  <TableCell>
                    {event.isRecurring && (
                      <span
                        title={`${event.dayPattern} · ${event.recurrenceStart} – ${event.recurrenceEnd}`}
                        className="flex items-center gap-1"
                      >
                        <i className="fa-solid fa-rotate text-amber-500 text-xs" />
                        <span className="text-xs text-muted-foreground">
                          {formatDayPattern(event.dayPattern)}
                        </span>
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{event.customer}</TableCell>
                  <TableCell className="text-xs text-muted-foreground font-mono">
                    {event.aircraftType ?? "—"}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-xs">
                    {event.isRecurring
                      ? event.arrivalTimeUtc
                        ? `${event.arrivalTimeUtc} UTC`
                        : "—"
                      : formatDatetime(event.scheduledArrival)}
                  </TableCell>
                  <TableCell className="text-sm font-mono text-xs">
                    {event.isRecurring
                      ? event.departureTimeUtc
                        ? `${event.departureTimeUtc} UTC`
                        : "—"
                      : formatDatetime(event.scheduledDeparture)}
                  </TableCell>
                  <TableCell className="text-xs text-muted-foreground">
                    {event.isRecurring ? (
                      <span className="text-xs">
                        {event.recurrenceStart} → {event.recurrenceEnd}
                      </span>
                    ) : (
                      <>
                        +{event.arrivalWindowMinutes}m / -{event.departureWindowMinutes}m
                      </>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_STYLES[event.status] ?? ""}>
                      {event.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SOURCE_STYLES[event.source] ?? ""}>
                      {event.source === "work_package" ? "WP" : event.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(event)}
                        className="h-7 w-7 p-0"
                      >
                        <i className="fa-solid fa-pen text-xs" />
                      </Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 w-7 p-0 text-destructive"
                          >
                            <i className="fa-solid fa-trash text-xs" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete Flight Event</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete the {event.status} event for{" "}
                              {event.aircraftReg ?? "unassigned aircraft"} ({event.customer})? This
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(event.id)}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <FlightEventEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        event={editingEvent}
        onSave={handleSave}
      />
    </div>
  );
}
