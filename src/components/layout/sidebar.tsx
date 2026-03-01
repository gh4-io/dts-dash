"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils/cn";
import { useAppTitle } from "@/components/layout/app-config-provider";
import { useSidebar } from "@/lib/hooks/use-sidebar";
import { useDeviceType } from "@/lib/hooks/use-device-type";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: "fa-solid fa-chart-line" },
  { href: "/flight-board", label: "Flight Board", icon: "fa-solid fa-plane-departure" },
  { href: "/capacity", label: "Capacity", icon: "fa-solid fa-gauge-high" },
  { href: "/feedback", label: "Feedback", icon: "fa-solid fa-comments" },
];

export function Sidebar() {
  const pathname = usePathname();
  const appTitle = useAppTitle();
  const { mode, cycleMode } = useSidebar();
  const device = useDeviceType();

  const isExpanded = mode === "expanded";
  const isIcons = mode === "icons";
  const isCollapsed = mode === "collapsed";

  // Hide sidebar on phone, show on tablet/desktop
  if (device.type === "phone") {
    return null;
  }

  return (
    <aside
      data-print="hide"
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-in-out",
        isExpanded && "w-60",
        isIcons && "w-14",
        isCollapsed && "w-0 border-r-0 overflow-hidden",
      )}
    >
      {/* Logo / title */}
      <div
        className={cn(
          "flex h-14 items-center border-b border-sidebar-border",
          isExpanded ? "px-4" : "justify-center px-2",
        )}
      >
        <Link
          href="/dashboard"
          className="flex items-center gap-2 font-semibold text-sidebar-foreground overflow-hidden"
        >
          <i className="fa-solid fa-plane-circle-check text-primary text-xl shrink-0" />
          <span
            className={cn(
              "text-xl whitespace-nowrap transition-opacity duration-200",
              isIcons ? "opacity-0 w-0 overflow-hidden" : "opacity-100",
            )}
          >
            {appTitle}
          </span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className={cn("flex-1 space-y-1 py-3", isExpanded ? "px-2" : "px-1")}>
        {navItems.map((item) => {
          const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

          const linkContent = (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors min-h-[44px]",
                isIcons && "justify-center px-0",
                isActive
                  ? "bg-sidebar-accent text-sidebar-accent-foreground"
                  : "text-sidebar-foreground/70 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground",
              )}
            >
              <i className={cn(item.icon, "w-5 text-center shrink-0")} />
              <span
                className={cn(
                  "whitespace-nowrap transition-opacity duration-200",
                  isIcons ? "opacity-0 w-0 overflow-hidden" : "opacity-100",
                )}
              >
                {item.label}
              </span>
            </Link>
          );

          // Wrap in tooltip only when in icon mode (not on lg+ where labels show)
          if (isIcons) {
            return (
              <Tooltip key={item.href}>
                <TooltipTrigger asChild>{linkContent}</TooltipTrigger>
                <TooltipContent side="right" sideOffset={8}>
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return linkContent;
        })}
      </nav>

      {/* Collapse toggle */}
      <div className={cn("border-t border-sidebar-border p-2", isIcons && "flex justify-center")}>
        <button
          onClick={cycleMode}
          className="flex h-9 w-full items-center justify-center rounded-md text-muted-foreground hover:bg-sidebar-accent/50 hover:text-sidebar-foreground transition-colors"
          title={isExpanded ? "Collapse sidebar" : isIcons ? "Hide sidebar" : "Expand sidebar"}
        >
          <i
            className={cn(
              "fa-solid transition-transform duration-200",
              isExpanded ? "fa-chevron-left" : isIcons ? "fa-chevron-left" : "fa-chevron-right",
            )}
          />
        </button>
      </div>
    </aside>
  );
}
