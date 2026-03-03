"use client";

import { useEffect, useState, useCallback, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { useTheme } from "next-themes";
import { usePreferences } from "@/lib/hooks/use-preferences";
import { Separator } from "@/components/ui/separator";

interface MobileMenuPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const NAV_ITEMS = [
  { href: "/settings", label: "Settings", icon: "fa-solid fa-gear" },
  { href: "/account", label: "Account", icon: "fa-solid fa-user" },
] as const;

export function MobileMenuPopup({ open, onOpenChange }: MobileMenuPopupProps) {
  const { data: session } = useSession();
  const pathname = usePathname();
  const { theme, resolvedTheme, setTheme } = useTheme();
  const { update: updatePrefs } = usePreferences();

  // Track closing state for exit animation
  const [closing, setClosing] = useState(false);

  // Hydration-safe mounted flag
  const mounted = useSyncExternalStore(
    () => () => {},
    () => true,
    () => false,
  );

  const isAdmin = session?.user?.role === "admin" || session?.user?.role === "superadmin";

  // Close with exit animation
  const handleClose = useCallback(() => {
    setClosing(true);
    setTimeout(() => {
      setClosing(false);
      onOpenChange(false);
    }, 200);
  }, [onOpenChange]);

  // Escape key handler
  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") handleClose();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, handleClose]);

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
    : theme === "system"
      ? "fa-solid fa-circle-half-stroke"
      : resolvedTheme === "dark"
        ? "fa-solid fa-moon"
        : "fa-solid fa-sun";

  const themeLabel = mounted
    ? theme === "dark"
      ? "Dark"
      : theme === "light"
        ? "Light"
        : "System"
    : "System";

  if (!open && !closing) return null;

  const animationClass = closing
    ? "animate-out fade-out-0 slide-out-to-bottom-4"
    : "animate-in fade-in-0 slide-in-from-bottom-4";

  const isActive = (href: string) => pathname === href || pathname.startsWith(href + "/");

  return (
    <>
      {/* Backdrop — z-40 so it sits below the tab bar (z-50) */}
      <div
        className={`fixed inset-0 z-40 bg-black/30 transition-opacity ${
          closing ? "opacity-0" : "opacity-100"
        }`}
        onClick={handleClose}
        aria-hidden="true"
      />

      {/* Popup panel — z-50 to match tab bar, positioned above it */}
      <div
        role="menu"
        className={`fixed right-4 z-50 w-56 rounded-lg border border-border bg-popover p-1.5 shadow-lg bottom-[calc(env(safe-area-inset-bottom)+56px)] ${animationClass}`}
        style={{ animationDuration: "200ms", animationFillMode: "both" }}
      >
        {/* Navigation items */}
        {NAV_ITEMS.map((item) => (
          <Link
            key={item.href}
            href={item.href}
            role="menuitem"
            onClick={handleClose}
            className={`flex items-center justify-between gap-3 rounded-md px-3 min-h-11 text-sm transition-colors ${
              isActive(item.href)
                ? "bg-accent text-accent-foreground font-medium"
                : "text-popover-foreground hover:bg-accent/50"
            }`}
          >
            <span>{item.label}</span>
            <i className={`${item.icon} w-5 text-center text-muted-foreground`} />
          </Link>
        ))}

        {/* Admin link — role-gated */}
        {isAdmin && (
          <Link
            href="/admin"
            role="menuitem"
            onClick={handleClose}
            className={`flex items-center justify-between gap-3 rounded-md px-3 min-h-11 text-sm transition-colors ${
              isActive("/admin")
                ? "bg-accent text-accent-foreground font-medium"
                : "text-popover-foreground hover:bg-accent/50"
            }`}
          >
            <span>Admin</span>
            <i className="fa-solid fa-shield-halved w-5 text-center text-muted-foreground" />
          </Link>
        )}

        <Separator className="my-1" />

        {/* Theme toggle */}
        <button
          role="menuitem"
          onClick={toggleTheme}
          className="flex w-full items-center justify-between gap-3 rounded-md px-3 min-h-11 text-sm text-popover-foreground hover:bg-accent/50 transition-colors"
        >
          <span>Theme: {themeLabel}</span>
          <i className={`${themeIcon} w-5 text-center text-muted-foreground`} />
        </button>

        <Separator className="my-1" />

        {/* Logout */}
        <button
          role="menuitem"
          onClick={async () => {
            handleClose();
            await signOut({ callbackUrl: "/login" });
          }}
          className="flex w-full items-center justify-between gap-3 rounded-md px-3 min-h-11 text-sm text-destructive hover:bg-destructive/10 transition-colors"
        >
          <span>Logout</span>
          <i className="fa-solid fa-right-from-bracket w-5 text-center" />
        </button>
      </div>
    </>
  );
}
