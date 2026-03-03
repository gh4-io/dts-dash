"use client";

const DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

interface RotationDotsProps {
  pattern: string; // 21-char: x=work, o=off
  categoryColor?: string; // tailwind bg color class for working dots
  /** "sm" = compact inline strip (default), "md" = 3×7 grid with week labels, "inline" = all 21 outlined blocks in a row */
  size?: "sm" | "md" | "inline";
  showWeekLabels?: boolean;
  interactive?: boolean;
  onToggle?: (index: number) => void;
}

/**
 * Visual representation of a 3-week rotation pattern.
 * - "sm" (default): inline 21-square strip, zero gap, 5×10px — used in shift bars.
 * - "md": 3-row × 7-col grid with optional week/day labels — used in dialogs and previews.
 * - "inline": all 21 outlined blocks in a single row, 8×8px, 1px gap — used in list rows.
 */
export function RotationDots({
  pattern,
  categoryColor,
  size = "sm",
  showWeekLabels = false,
  interactive = false,
  onToggle,
}: RotationDotsProps) {
  const fillColor = categoryColor ?? "bg-primary";

  if (size === "md") {
    return (
      <div className="inline-flex flex-col gap-0.5">
        {showWeekLabels && (
          <div className="flex gap-0.5 ml-7">
            {DAY_LABELS.map((d, i) => (
              <span key={i} className="w-[14px] text-center text-[8px] text-muted-foreground">
                {d}
              </span>
            ))}
          </div>
        )}
        {[0, 1, 2].map((week) => (
          <div key={week} className="flex items-center gap-0.5">
            {showWeekLabels && (
              <span className="w-6 text-[8px] text-muted-foreground text-right pr-1">
                W{week + 1}
              </span>
            )}
            {[0, 1, 2, 3, 4, 5, 6].map((day) => {
              const idx = week * 7 + day;
              const isWork = pattern[idx] === "x";
              return (
                <span
                  key={day}
                  className={`w-[14px] h-[14px] rounded-[2px] border ${
                    isWork ? `${fillColor} border-primary/70` : "bg-muted border-border"
                  } ${interactive ? "cursor-pointer hover:opacity-80" : ""}`}
                  onClick={interactive && onToggle ? () => onToggle(idx) : undefined}
                />
              );
            })}
          </div>
        ))}
      </div>
    );
  }

  // inline: all 21 outlined blocks in a single row
  if (size === "inline") {
    return (
      <span className="inline-flex items-center" style={{ gap: "1px" }}>
        {pattern.split("").map((ch, i) => {
          const isWork = ch === "x";
          return (
            <span
              key={i}
              className={`w-2 h-2 rounded-[1px] border ${
                isWork ? `${fillColor} border-primary/70` : "bg-muted border-border"
              } ${interactive ? "cursor-pointer hover:opacity-80" : ""}`}
              onClick={interactive && onToggle ? () => onToggle(i) : undefined}
            />
          );
        })}
      </span>
    );
  }

  // sm: compact inline strip
  return (
    <span className="inline-flex" style={{ gap: 0 }}>
      {pattern.split("").map((ch, i) => {
        const isWork = ch === "x";
        return (
          <span
            key={i}
            className={`w-[5px] h-[10px] ${
              isWork ? fillColor : "bg-muted-foreground/15"
            } ${i === 0 ? "rounded-l-[1px]" : ""} ${i === 20 ? "rounded-r-[1px]" : ""} ${
              interactive ? "cursor-pointer hover:opacity-80" : ""
            }`}
            onClick={interactive && onToggle ? () => onToggle(i) : undefined}
          />
        );
      })}
    </span>
  );
}
