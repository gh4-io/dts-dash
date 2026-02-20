"use client";

import { useState } from "react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useActions } from "@/lib/hooks/use-actions";
import { useFilters } from "@/lib/hooks/use-filters";
import { ColumnsFilterDialog } from "./actions-menu/columns-filter-dialog";
import { SortDialog } from "./actions-menu/sort-dialog";
import { ControlBreakDialog } from "./actions-menu/control-break-dialog";
import { HighlightDialog } from "./actions-menu/highlight-dialog";
import { GroupByDialog } from "./actions-menu/group-by-dialog";

type DialogId = "columns" | "sort" | "break" | "highlight" | "groupBy" | null;

export function ActionsMenu() {
  const [openDialog, setOpenDialog] = useState<DialogId>(null);
  const { resetAll, activeCount } = useActions();
  const { setOperators, setAircraft, setTypes } = useFilters();

  const count = activeCount();

  const handleReset = () => {
    resetAll();
    setOperators([]);
    setAircraft([]);
    setTypes([]);
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            size="sm"
            className="h-9 text-xs gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"
          >
            <i className="fa-solid fa-bolt" />
            Actions
            {count > 0 && (
              <span className="ml-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-white/20 text-[10px] font-bold">
                {count}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-[200px]">
          {/* Filters submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <i className="fa-solid fa-filter text-muted-foreground mr-2 w-4 text-center" />
              Filters
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => setOpenDialog("columns")}>
                <i className="fa-solid fa-table-columns text-muted-foreground mr-2 w-4 text-center" />
                Columns
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <i className="fa-solid fa-bars text-muted-foreground mr-2 w-4 text-center" />
                Rows
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          {/* Format submenu */}
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <i className="fa-solid fa-sliders text-muted-foreground mr-2 w-4 text-center" />
              Format
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              <DropdownMenuItem onSelect={() => setOpenDialog("sort")}>
                <i className="fa-solid fa-arrow-down-short-wide text-muted-foreground mr-2 w-4 text-center" />
                Sort
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenDialog("break")}>
                <i className="fa-solid fa-grip-lines text-muted-foreground mr-2 w-4 text-center" />
                Control Break
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenDialog("highlight")}>
                <i className="fa-solid fa-highlighter text-muted-foreground mr-2 w-4 text-center" />
                Highlight
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <i className="fa-solid fa-calculator text-muted-foreground mr-2 w-4 text-center" />
                Compute
              </DropdownMenuItem>
              <DropdownMenuItem disabled>
                <i className="fa-solid fa-chart-bar text-muted-foreground mr-2 w-4 text-center" />
                Chart
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={() => setOpenDialog("groupBy")}>
                <i className="fa-solid fa-layer-group text-muted-foreground mr-2 w-4 text-center" />
                Group By
              </DropdownMenuItem>
            </DropdownMenuSubContent>
          </DropdownMenuSub>

          <DropdownMenuSeparator />

          {/* Reset */}
          <DropdownMenuItem onSelect={handleReset}>
            <i className="fa-solid fa-rotate-left text-muted-foreground mr-2 w-4 text-center" />
            Reset
          </DropdownMenuItem>

          {/* Stubs */}
          <DropdownMenuItem disabled>
            <i className="fa-solid fa-circle-question text-muted-foreground mr-2 w-4 text-center" />
            Help
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            <i className="fa-solid fa-download text-muted-foreground mr-2 w-4 text-center" />
            Download
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Dialogs rendered outside DropdownMenu tree to avoid z-index conflicts */}
      <ColumnsFilterDialog
        open={openDialog === "columns"}
        onOpenChange={(v) => setOpenDialog(v ? "columns" : null)}
      />
      <SortDialog
        open={openDialog === "sort"}
        onOpenChange={(v) => setOpenDialog(v ? "sort" : null)}
      />
      <ControlBreakDialog
        open={openDialog === "break"}
        onOpenChange={(v) => setOpenDialog(v ? "break" : null)}
      />
      <HighlightDialog
        open={openDialog === "highlight"}
        onOpenChange={(v) => setOpenDialog(v ? "highlight" : null)}
      />
      <GroupByDialog
        open={openDialog === "groupBy"}
        onOpenChange={(v) => setOpenDialog(v ? "groupBy" : null)}
      />
    </>
  );
}
