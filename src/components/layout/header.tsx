"use client";

import { useTheme } from "next-themes";
import { signOut, useSession } from "next-auth/react";
import Link from "next/link";
import { useState, useRef, useEffect, useSyncExternalStore } from "react";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { MobileNav } from "./mobile-nav";

export function Header() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { data: session } = useSession();
  const { update: updatePrefs } = usePreferences();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );
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

  const toggleTheme = () => {
    let next: "dark" | "light" | "system";
    if (theme === "dark") next = "light";
    else if (theme === "light") next = "system";
    else next = "dark";

    setTheme(next);
    updatePrefs({ colorMode: next });
  };

  const themeIcon = !mounted
    ? "fa-solid fa-circle-half-stroke"
    : resolvedTheme === "dark"
      ? "fa-solid fa-moon"
      : resolvedTheme === "light"
        ? "fa-solid fa-sun"
        : "fa-solid fa-circle-half-stroke";

  const themeLabel = mounted ? (theme ?? "system") : "system";

  const role = (session?.user as { role?: string })?.role;
  const isAdmin = role === "admin" || role === "superadmin";

  return (
    <header className="flex h-14 items-center justify-between border-b border-border bg-background px-4">
      {/* Mobile menu button */}
      <button
        className="md:hidden p-2 text-muted-foreground hover:text-foreground"
        onClick={() => setMobileNavOpen(true)}
      >
        <i className="fa-solid fa-bars" />
      </button>
      <MobileNav open={mobileNavOpen} onOpenChange={setMobileNavOpen} />

      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Theme toggle */}
        <button
          onClick={toggleTheme}
          className="flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          title={`Theme: ${themeLabel}`}
        >
          <i className={themeIcon} />
        </button>

        {/* User menu */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setMenuOpen(!menuOpen)}
            className="flex h-9 items-center gap-2 rounded-md px-3 text-sm text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
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
