"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { useAppTitle } from "@/components/layout/app-config-provider";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line" },
  { href: "/flight-board", label: "Flight Board", icon: "fa-solid fa-plane-departure" },
  { href: "/capacity", label: "Capacity", icon: "fa-solid fa-gauge-high" },
  { href: "/feedback", label: "Feedback", icon: "fa-solid fa-comments" },
];

interface MobileNavProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileNav({ open, onOpenChange }: MobileNavProps) {
  const pathname = usePathname();
  const appTitle = useAppTitle();

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="left" className="w-64 p-0">
        <SheetHeader className="flex h-14 items-center border-b border-border px-4">
          <SheetTitle className="flex items-center gap-2 font-semibold text-xl">
            <i className="fa-solid fa-plane-circle-check text-primary" />
            {appTitle}
          </SheetTitle>
        </SheetHeader>
        <nav className="flex-1 space-y-1 px-2 py-3">
          {navItems.map((item) => {
            const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => onOpenChange(false)}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted-foreground hover:bg-accent/50 hover:text-foreground",
                )}
              >
                <i className={cn(item.icon, "w-5 text-center")} />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </SheetContent>
    </Sheet>
  );
}
