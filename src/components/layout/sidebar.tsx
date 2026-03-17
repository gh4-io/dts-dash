"use client";

import { useEffect } from "react";
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

/**
 * Floating toggle button that sits on the sidebar/content border.
 * Rendered as a sibling of the sidebar in the layout to avoid overflow clipping.
 */
export function SidebarEdgeToggle() {
  const { mode, toggleSemiCollapse } = useSidebar();
  const device = useDeviceType();

  // Only show on tablet (not phone, not desktop)
  if (device.type !== "tablet") return null;
  // Don't show when fully collapsed (use header hamburger to restore)
  if (mode === "collapsed") return null;

  const isExpanded = mode === "expanded";

  return (
    <button
      data-print="hide"
      onClick={toggleSemiCollapse}
      className={cn(
        "absolute top-11 z-30",
        "flex h-9 w-9 items-center justify-center",
        "rounded-full border border-border shadow-sm",
        "bg-sidebar text-muted-foreground",
        "hover:bg-sidebar-accent hover:text-sidebar-foreground",
        "transition-all duration-200",
        // Center on the sidebar edge (offset left by half the button: width 36px / 2 = 18px)
        isExpanded ? "left-[222px]" : "left-[38px]",
      )}
      title={isExpanded ? "Collapse sidebar" : "Expand sidebar"}
    >
      <i
        className={cn(
          "fa-solid text-base transition-transform duration-200",
          isExpanded ? "fa-chevron-left" : "fa-chevron-right",
        )}
      />
    </button>
  );
}

export function Sidebar() {
  const pathname = usePathname();
  const appTitle = useAppTitle();
  const { mode, setMode, toggleSemiCollapse } = useSidebar();
  const device = useDeviceType();

  // Auto-expand sidebar when switching to desktop (toggle not available there)
  useEffect(() => {
    if (device.type === "desktop" && mode !== "expanded") {
      setMode("expanded");
    }
  }, [device.type]); // eslint-disable-line react-hooks/exhaustive-deps -- only react to device changes, not mode

  const isExpanded = mode === "expanded";
  const isIcons = mode === "icons";
  const isCollapsed = mode === "collapsed";
  const isTablet = device.type === "tablet";

  // Hide sidebar on phone, show on tablet/desktop
  if (device.type === "phone") {
    return null;
  }

  // On tablet, tapping empty sidebar area toggles semi-collapse
  const handleSidebarTap = isTablet
    ? (e: React.MouseEvent<HTMLElement>) => {
        // Only toggle if the tap target is the aside itself or non-interactive children
        // (not nav links, buttons, or the logo link)
        const target = e.target as HTMLElement;
        if (target.closest("a, button")) return;
        toggleSemiCollapse();
      }
    : undefined;

  return (
    <aside
      data-print="hide"
      onClick={handleSidebarTap}
      className={cn(
        "flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-200 ease-in-out",
        isExpanded && "w-60",
        isIcons && "w-14",
        isCollapsed && "w-0 border-r-0 overflow-hidden",
        isTablet && !isCollapsed && "cursor-pointer",
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
    </aside>
  );
}
