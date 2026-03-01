import { cn } from "@/lib/utils/cn";

interface LoadingSkeletonProps {
  variant: "card" | "chart" | "table" | "page";
  count?: number;
  className?: string;
}

function SkeletonBlock({ className }: { className?: string }) {
  return <div className={cn("rounded-lg border border-border bg-card animate-pulse", className)} />;
}

export function LoadingSkeleton({ variant, count = 4, className }: LoadingSkeletonProps) {
  switch (variant) {
    case "card":
      return (
        <div className={cn("space-y-3", className)}>
          {Array.from({ length: count }, (_, i) => (
            <SkeletonBlock key={i} className="h-24 p-4" />
          ))}
        </div>
      );

    case "chart":
      return <SkeletonBlock className={cn("h-80 p-4", className)} />;

    case "table":
      return (
        <div className={cn("space-y-2", className)}>
          <SkeletonBlock className="h-10" />
          {Array.from({ length: count }, (_, i) => (
            <SkeletonBlock key={i} className="h-12" />
          ))}
        </div>
      );

    case "page":
      return (
        <div className={cn("grid grid-cols-1 xl:grid-cols-[250px_1fr_300px] gap-3", className)}>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <SkeletonBlock key={i} className="h-24 p-4" />
            ))}
          </div>
          <SkeletonBlock className="h-80 p-4" />
          <SkeletonBlock className="h-72 p-4" />
        </div>
      );
  }
}
