"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line" },
  { href: "/flight-board", label: "Flights", icon: "fa-solid fa-plane-departure" },
  { href: "/capacity", label: "Capacity", icon: "fa-solid fa-gauge-high" },
  { href: "/feedback", label: "Feedback", icon: "fa-solid fa-comments" },
];

export function BottomTabBar() {
  const pathname = usePathname();

  return (
    <nav
      data-print="hide"
      className="fixed bottom-0 left-0 right-0 z-50 flex md:hidden border-t border-border bg-background pb-[env(safe-area-inset-bottom)]"
    >
      {navItems.map((item) => {
        const isActive = pathname === item.href || pathname.startsWith(item.href + "/");
        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium transition-colors",
              isActive
                ? "text-primary border-t-2 border-primary -mt-px"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <i className={cn(item.icon, "text-base")} />
            <span>{item.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
