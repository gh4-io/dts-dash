"use client";

import type { ReactNode } from "react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

interface FormatDropdownProps {
  children: ReactNode;
}

export function FormatDropdown({ children }: FormatDropdownProps) {
  if (!children) return null;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="h-9 text-xs gap-1.5">
          <i className="fa-solid fa-sliders text-muted-foreground" />
          Format
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-3" align="end">
        {children}
      </PopoverContent>
    </Popover>
  );
}
