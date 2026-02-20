"use client";

/**
 * Step 1: Select Import Type
 *
 * Grid of schema cards grouped by category.
 * Single-item categories share a grid row, each with its own heading above the card.
 * Multi-item categories get a full-width heading + grid.
 */

import type { SerializableSchema } from "@/lib/import/types";

interface StepSelectTypeProps {
  schemas: SerializableSchema[];
  onSelect: (schemaId: string) => void;
}

const GRID_CLASSES = "grid gap-3 grid-cols-[repeat(auto-fill,minmax(min(100%,380px),1fr))]";

function SchemaCard({
  schema,
  onSelect,
}: {
  schema: SerializableSchema;
  onSelect: (id: string) => void;
}) {
  return (
    <button
      onClick={() => onSelect(schema.id)}
      className="group flex w-full items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-primary/50 hover:bg-accent"
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
  );
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

  // Split into single-item (share a grid row) and multi-item (full section) categories
  const singleCategories: string[] = [];
  const multiCategories: string[] = [];

  for (const cat of sortedCategories) {
    if (grouped[cat].length === 1) {
      singleCategories.push(cat);
    } else {
      multiCategories.push(cat);
    }
  }

  return (
    <div className="space-y-6">
      {/* Single-item categories — each cell has its own heading + card */}
      {singleCategories.length > 0 && (
        <div className={GRID_CLASSES}>
          {singleCategories.map((category) => (
            <div key={category} className="space-y-2">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
                {category}
              </h3>
              <SchemaCard schema={grouped[category][0]} onSelect={onSelect} />
            </div>
          ))}
        </div>
      )}

      {/* Multi-item categories — full-width heading + grid */}
      {multiCategories.map((category) => (
        <div key={category} className="space-y-3">
          <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            {category}
          </h3>
          <div className={GRID_CLASSES}>
            {grouped[category].map((schema) => (
              <SchemaCard key={schema.id} schema={schema} onSelect={onSelect} />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
