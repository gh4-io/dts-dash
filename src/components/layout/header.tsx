"use client";

import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useDeviceType } from "@/lib/hooks/use-device-type";
import { useSidebar } from "@/lib/hooks/use-sidebar";
import { MobileNav } from "./mobile-nav";
import { DataFreshnessBadge } from "@/components/shared/data-freshness-badge";
import { NotificationBell } from "./notification-bell";

export function Header() {
  const { data: session } = useSession();
  const device = useDeviceType();
  const sidebarMode = useSidebar((s) => s.mode);
  const setSidebarMode = useSidebar((s) => s.setMode);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin" || role === "superadmin";

  // Hide entire header on phone — bottom tab bar + menu sheet handle navigation
  if (device.type === "phone") {
    return null;
  }

  return (
    <header
      data-print="hide"
      className="flex h-14 items-center justify-between border-b border-border bg-background px-4"
    >
      {/* Sidebar is fully collapsed, so no nav is visible and the sidebar's own
          edge toggle has unmounted with it. This is the only way back.

          It has to branch on width. Below md the sidebar is not the navigation
          (D-053) and the sheet is correct. At md and above the sidebar IS the
          navigation, and opening a sheet left it collapsed — with the mode
          persisted to localStorage, a reload restored the collapse too, so
          there was genuinely no route back short of clearing storage. */}
      {sidebarMode === "collapsed" && (
        <>
          <button
            className="md:hidden p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open navigation menu"
            title="Menu"
          >
            <i className="fa-solid fa-bars" />
          </button>
          <button
            className="hidden md:block p-2 text-muted-foreground hover:text-foreground"
            onClick={() => setSidebarMode("expanded")}
            aria-label="Show sidebar"
            title="Show sidebar"
          >
            <i className="fa-solid fa-bars" />
          </button>
        </>
      )}
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="flex-1" />

      <div className="hidden sm:flex items-center mr-3">
        <DataFreshnessBadge />
      </div>

      <div className="flex items-center gap-2">
        <NotificationBell />

        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-11 md:h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <i className="fa-solid fa-user-circle" />
            <span className="hidden sm:inline">{session?.user?.name || "User"}</span>
            <i className="fa-solid fa-chevron-down text-xs" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-full z-50 mt-1 w-48 rounded-md border border-border bg-popover py-1 shadow-lg">
              <Link
                href="/account"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-accent"
              >
                <i className="fa-solid fa-user w-4 text-center" />
                Account
              </Link>
              <Link
                href="/settings"
                onClick={() => setMenuOpen(false)}
                className="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-accent"
              >
                <i className="fa-solid fa-gear w-4 text-center" />
                Settings
              </Link>
              {isAdmin && (
                <Link
                  href="/admin"
                  onClick={() => setMenuOpen(false)}
                  className="flex items-center gap-2 px-4 py-2 text-sm text-popover-foreground hover:bg-accent"
                >
                  <i className="fa-solid fa-shield-halved w-4 text-center" />
                  Admin
                </Link>
              )}
              <hr className="my-1 border-border" />
              <button
                onClick={() => {
                  signOut({ callbackUrl: "/login" });
                }}
                className="flex w-full items-center gap-2 px-4 py-2 text-sm text-destructive hover:bg-accent"
              >
                <i className="fa-solid fa-right-from-bracket w-4 text-center" />
                Logout
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
