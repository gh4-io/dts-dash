"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Badge } from "@/components/ui/badge";

const NAV_ITEMS = [
  { label: "Customers", href: "/admin/customers", icon: "fa-solid fa-palette" },
  {
    label: "Aircraft Types",
    href: "/admin/aircraft-types",
    icon: "fa-solid fa-plane-circle-check",
    badge: "M7",
  },
  { label: "Data Import", href: "/admin/import", icon: "fa-solid fa-file-import", badge: "M7" },
  { label: "Users", href: "/admin/users", icon: "fa-solid fa-users-gear" },
  { label: "Settings", href: "/admin/settings", icon: "fa-solid fa-cogs" },
  { label: "Server", href: "/admin/server", icon: "fa-solid fa-server" },
  { label: "Cron Jobs", href: "/admin/cron", icon: "fa-solid fa-clock-rotate-left" },
  { label: "Analytics", href: "/admin/analytics", icon: "fa-solid fa-chart-bar", badge: "M8" },
  { label: "Audit Log", href: "/admin/audit", icon: "fa-solid fa-clipboard-list", badge: "vNext" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="overflow-x-auto">
      <div className="flex gap-1 border-b border-border pb-px min-w-max">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 whitespace-nowrap rounded-t-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "border-b-2 border-primary bg-accent text-accent-foreground"
                  : "text-muted-foreground hover:bg-accent/50 hover:text-accent-foreground"
              }`}
            >
              <i className={`${item.icon} text-xs`} />
              {item.label}
              {item.badge && (
                <Badge
                  variant="outline"
                  className="ml-1 text-[10px] px-1 py-0 text-muted-foreground"
                >
                  {item.badge}
                </Badge>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
