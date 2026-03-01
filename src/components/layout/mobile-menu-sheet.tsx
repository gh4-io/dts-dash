"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useSyncExternalStore } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Separator } from "@/components/ui/separator";

interface MobileMenuSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileMenuSheet({ open, onOpenChange }: MobileMenuSheetProps) {
  const { data: session } = useSession();
  const pathname = usePathname();

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "superadmin";
  const isFlightBoard = pathname.includes("/flight-board");

  // Read current view mode from localStorage using useSyncExternalStore
  const viewMode = useSyncExternalStore(
    (subscribe) => {
      // Subscribe to custom event for view mode changes
      const handleChange = () => {
        // Trigger re-render by calling the callback
        subscribe();
      };
      window.addEventListener("flightBoardViewModeChanged", handleChange);
      return () => window.removeEventListener("flightBoardViewModeChanged", handleChange);
    },
    () => {
      const stored = localStorage.getItem("flightBoardViewMode");
      return (stored === "gantt" || stored === "list" ? stored : "gantt") as "list" | "gantt";
    },
    () => "gantt" as const,
  );

  const toggleViewMode = () => {
    const newMode = viewMode === "list" ? "gantt" : "list";
    localStorage.setItem("flightBoardViewMode", newMode);
    // Dispatch event to notify flight board page and this component
    window.dispatchEvent(new CustomEvent("flightBoardViewModeChanged", { detail: newMode }));
    onOpenChange(false);
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-auto rounded-t-2xl">
        <SheetHeader className="mb-4">
          <SheetTitle>Menu</SheetTitle>
        </SheetHeader>

        <div className="flex flex-col gap-4 pb-6 max-w-md mx-auto">
          {/* User Info */}
          {session?.user && (
            <>
              <div className="px-4 py-3 bg-muted rounded-lg">
                <p className="font-semibold text-sm">{session.user.name || "User"}</p>
                <p className="text-xs text-muted-foreground">{session.user.email}</p>
              </div>

              <Separator />
            </>
          )}

          {/* Account Link */}
          <Link
            href="/account"
            onClick={() => onOpenChange(false)}
            className="flex items-center gap-3 px-4 py-3 hover:bg-muted rounded transition-colors"
          >
            <i className="fa-solid fa-user text-base w-5 text-center" />
            <span className="text-sm">Account</span>
          </Link>

          {/* Admin Link */}
          {isAdmin && (
            <Link
              href="/admin"
              onClick={() => onOpenChange(false)}
              className="flex items-center gap-3 px-4 py-3 hover:bg-muted rounded transition-colors"
            >
              <i className="fa-solid fa-shield-halved text-base w-5 text-center" />
              <span className="text-sm">Admin</span>
            </Link>
          )}

          {/* View Mode Toggle (Flight Board only) */}
          {isFlightBoard && (
            <>
              <Separator />
              <button
                onClick={toggleViewMode}
                className="flex items-center gap-3 px-4 py-3 hover:bg-muted rounded transition-colors text-left w-full"
              >
                <i
                  className={`fa-solid ${
                    viewMode === "list" ? "fa-list" : "fa-chart-gantt"
                  } text-base w-5 text-center`}
                />
                <span className="text-sm">View: {viewMode === "list" ? "List" : "Gantt"}</span>
              </button>
            </>
          )}

          <Separator />

          {/* Logout */}
          <button
            onClick={async () => {
              onOpenChange(false);
              await signOut({ callbackUrl: "/login" });
            }}
            className="flex items-center gap-3 px-4 py-3 hover:bg-destructive/10 text-destructive rounded transition-colors text-left"
          >
            <i className="fa-solid fa-right-from-bracket text-base w-5 text-center" />
            <span className="text-sm">Logout</span>
          </button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
