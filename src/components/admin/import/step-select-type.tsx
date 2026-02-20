"use client";

/**
 * Step 1: Select Import Type
 *
 * Grid of schema cards grouped by category.
 */

import type { SerializableSchema } from "@/lib/import/types";

interface StepSelectTypeProps {
  schemas: SerializableSchema[];
  onSelect: (schemaId: string) => void;
}

export function StepSelectType({ schemas, onSelect }: StepSelectTypeProps) {
  // Group by category
  const grouped: Record<string, SerializableSchema[]> = {};
  for (const schema of schemas) {
    const cat = schema.display.category;
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(schema);
  }

  const categoryOrder = ["Operations", "Master Data", "Administration", "Configuration"];
  const sortedCategories = Object.keys(grouped).sort(
    (a, b) =>
      (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) -
      (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b)),
  );

  return (
    <div className="space-y-6">
      {sortedCategories.map((category) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h3>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {grouped[category].map((schema) => (
              <button
                key={schema.id}
                onClick={() => onSelect(schema.id)}
                className="group flex items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <i className={`${schema.display.icon} text-lg`} />
                </div>
                <div className="min-w-0 space-y-1">
                  <div className="text-sm font-medium">{schema.display.name}</div>
                  <div className="text-xs text-muted-foreground">{schema.display.description}</div>
                  <div className="flex flex-wrap gap-1 pt-1">
                    {schema.formats.map((f) => (
                      <span
                        key={f}
                        className="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground"
                      >
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
