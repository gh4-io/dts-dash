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
import { TimeBookingEditor } from "./time-bookings-editor";
import type { TimeBooking } from "@/types";

const TASK_TYPE_STYLES: Record<string, string> = {
  routine: "border-slate-500/50 text-slate-400",
  non_routine: "border-amber-500/50 text-amber-500",
  aog: "border-red-500/50 text-red-500",
  training: "border-blue-500/50 text-blue-500",
  admin: "border-purple-500/50 text-purple-500",
};

const TASK_TYPE_LABELS: Record<string, string> = {
  routine: "Routine",
  non_routine: "Non-Routine",
  aog: "AOG",
  training: "Training",
  admin: "Admin",
};

const SHIFT_STYLES: Record<string, string> = {
  DAY: "border-amber-500/50 text-amber-500",
  SWING: "border-violet-500/50 text-violet-500",
  NIGHT: "border-slate-500/50 text-slate-400",
};

interface TimeBookingsGridProps {
  bookings: TimeBooking[];
  onCreate: (data: Omit<TimeBooking, "id" | "createdAt" | "updatedAt">) => Promise<void>;
  onUpdate: (id: number, updates: Partial<TimeBooking>) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
}

export function TimeBookingsGrid({
  bookings,
  onCreate,
  onUpdate,
  onDelete,
}: TimeBookingsGridProps) {
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingBooking, setEditingBooking] = useState<TimeBooking | null>(null);

  const handleAdd = () => {
    setEditingBooking(null);
    setEditorOpen(true);
  };

  const handleEdit = (booking: TimeBooking) => {
    setEditingBooking(booking);
    setEditorOpen(true);
  };

  const handleSave = async (data: Omit<TimeBooking, "id" | "createdAt" | "updatedAt">) => {
    if (editingBooking) {
      await onUpdate(editingBooking.id, data);
    } else {
      await onCreate(data);
    }
    setEditorOpen(false);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-sm font-semibold">Time Bookings</h2>
          <p className="text-xs text-muted-foreground">
            {bookings.length} booking{bookings.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button size="sm" onClick={handleAdd}>
          <i className="fa-solid fa-plus mr-1.5" />
          Add Booking
        </Button>
      </div>

      {bookings.length === 0 ? (
        <div className="rounded-lg border border-border bg-card p-8 text-center">
          <i className="fa-solid fa-clock text-3xl text-muted-foreground/50 mb-3 block" />
          <p className="text-sm text-muted-foreground">No time bookings recorded.</p>
          <p className="text-xs text-muted-foreground mt-1">
            Add bookings to track actual man-hours per task.
          </p>
        </div>
      ) : (
        <div className="rounded-lg border border-border overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Shift</TableHead>
                <TableHead>Aircraft</TableHead>
                <TableHead>Customer</TableHead>
                <TableHead>Task</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">MH</TableHead>
                <TableHead>Source</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bookings.map((booking) => (
                <TableRow key={booking.id} className={!booking.isActive ? "opacity-50" : ""}>
                  <TableCell className="text-sm font-mono">{booking.bookingDate}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={SHIFT_STYLES[booking.shiftCode] ?? ""}>
                      {booking.shiftCode}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm font-mono">{booking.aircraftReg}</TableCell>
                  <TableCell className="text-sm">{booking.customer}</TableCell>
                  <TableCell className="text-sm max-w-[150px] truncate">
                    {booking.taskName || <span className="text-muted-foreground">—</span>}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={TASK_TYPE_STYLES[booking.taskType] ?? ""}>
                      {TASK_TYPE_LABELS[booking.taskType] ?? booking.taskType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-sm font-mono font-medium">
                    {booking.workedMh.toFixed(1)}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="outline"
                      className={
                        booking.source === "import"
                          ? "border-amber-500/50 text-amber-500"
                          : "border-slate-500/50 text-slate-400"
                      }
                    >
                      {booking.source}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(booking)}
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
                            <AlertDialogTitle>Delete Time Booking</AlertDialogTitle>
                            <AlertDialogDescription>
                              Delete the {booking.workedMh} MH{" "}
                              {TASK_TYPE_LABELS[booking.taskType]?.toLowerCase() ??
                                booking.taskType}{" "}
                              booking for {booking.aircraftReg} on {booking.bookingDate}? This
                              cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => onDelete(booking.id)}
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

      <TimeBookingEditor
        open={editorOpen}
        onOpenChange={setEditorOpen}
        booking={editingBooking}
        onSave={handleSave}
      />
    </div>
  );
}
