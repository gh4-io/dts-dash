"use client";

import React, { useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { SerializableSchema } from "@/lib/import/types";

const STORAGE_KEY = "import-hub-help-open";

interface HelpPanelProps {
  schema: SerializableSchema | null;
  currentStep: number;
  isOpen: boolean;
  onClose: () => void;
}

/** Persist open/close preference to localStorage. */
function persistPreference(open: boolean) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(open));
  } catch {
    // localStorage unavailable — ignore
  }
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </h3>
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

function CodeBlock({ code }: { code: string }) {
  return (
    <pre className="bg-muted p-3 rounded-md text-xs font-mono overflow-x-auto whitespace-pre-wrap">
      {code}
    </pre>
  );
}

function TroubleshootingList({ items }: { items: Array<{ error: string; fix: string }> }) {
  return (
    <div className="space-y-3">
      {items.map((item, i) => (
        <div key={i} className="space-y-1">
          <div className="flex items-start gap-2">
            <i className="fa-solid fa-circle-exclamation text-destructive mt-0.5 text-xs shrink-0" />
            <span className="text-sm font-medium">{item.error}</span>
          </div>
          <div className="flex items-start gap-2 pl-5">
            <i className="fa-solid fa-arrow-right text-emerald-500 mt-0.5 text-xs shrink-0" />
            <span className="text-sm text-muted-foreground">{item.fix}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function FieldMappingTable({ fields }: { fields: SerializableSchema["fields"] }) {
  return (
    <div className="overflow-x-auto -mx-4 px-4">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="text-xs">Field</TableHead>
            <TableHead className="text-xs">Type</TableHead>
            <TableHead className="text-xs">Req</TableHead>
            <TableHead className="text-xs">Description</TableHead>
            <TableHead className="text-xs">Aliases</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {fields.map((field) => (
            <TableRow key={field.name}>
              <TableCell className="text-xs font-mono whitespace-nowrap">
                {field.label}
                {field.isKey && (
                  <i className="fa-solid fa-key text-amber-500 ml-1" title="Dedup key" />
                )}
              </TableCell>
              <TableCell className="text-xs">
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {field.type}
                </Badge>
              </TableCell>
              <TableCell className="text-xs">
                {field.required ? (
                  <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
                    required
                  </Badge>
                ) : (
                  <span className="text-muted-foreground">optional</span>
                )}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground max-w-[150px] truncate">
                {field.description ?? "—"}
              </TableCell>
              <TableCell className="text-xs text-muted-foreground">
                {field.aliases?.length ? (
                  <span className="font-mono text-[10px]">{field.aliases.join(", ")}</span>
                ) : (
                  "—"
                )}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}

// ─── Generic (no schema) content ─────────────────────────────────────────────

function GenericHelp() {
  return (
    <div className="space-y-4">
      <SectionHeading>Getting Started</SectionHeading>
      <p className="text-sm text-muted-foreground">
        Select a data type from the list to begin importing. Each data type has its own schema that
        defines the expected fields, formats, and validation rules.
      </p>

      <SectionHeading>Supported Formats</SectionHeading>
      <BulletList
        items={[
          "JSON — array of objects or OData response with { value: [...] }",
          "CSV — comma-separated values with a header row",
        ]}
      />

      <SectionHeading>Import Steps</SectionHeading>
      <BulletList
        items={[
          "1. Choose a data type",
          "2. Upload or paste your data",
          "3. Map source fields to target fields",
          "4. Review validation results",
          "5. Commit the import",
        ]}
      />
    </div>
  );
}

// ─── Schema-aware content ────────────────────────────────────────────────────

function SchemaHelp({ schema, currentStep }: { schema: SerializableSchema; currentStep: number }) {
  const { help, fields } = schema;

  // Step 3 = field mapping → show field table
  if (currentStep === 3) {
    return (
      <div className="space-y-4">
        <SectionHeading>Field Reference</SectionHeading>
        <p className="text-sm text-muted-foreground mb-2">
          Map your source columns to the fields below. Fields marked{" "}
          <Badge variant="destructive" className="text-[10px] px-1.5 py-0">
            required
          </Badge>{" "}
          must be mapped for the import to succeed.
        </p>
        <FieldMappingTable fields={fields} />

        {help.notes && help.notes.length > 0 && (
          <div className="mt-4">
            <SectionHeading>Notes</SectionHeading>
            <BulletList items={help.notes} />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Description */}
      <div>
        <SectionHeading>About</SectionHeading>
        <p className="text-sm text-muted-foreground">{help.description}</p>
      </div>

      {/* Expected format */}
      <div>
        <SectionHeading>Expected Format</SectionHeading>
        <p className="text-sm text-muted-foreground">{help.expectedFormat}</p>
      </div>

      {/* Sample snippet */}
      {help.sampleSnippet && (
        <div>
          <SectionHeading>Example</SectionHeading>
          <CodeBlock code={help.sampleSnippet} />
        </div>
      )}

      {/* Requirements */}
      {help.requirements && help.requirements.length > 0 && (
        <div>
          <SectionHeading>Requirements</SectionHeading>
          <BulletList items={help.requirements} />
        </div>
      )}

      {/* Notes */}
      {help.notes && help.notes.length > 0 && (
        <div>
          <SectionHeading>Notes</SectionHeading>
          <BulletList items={help.notes} />
        </div>
      )}

      {/* Troubleshooting */}
      {help.troubleshooting && help.troubleshooting.length > 0 && (
        <div>
          <SectionHeading>Troubleshooting</SectionHeading>
          <TroubleshootingList items={help.troubleshooting} />
        </div>
      )}
    </div>
  );
}

// ─── Main Panel ──────────────────────────────────────────────────────────────

export function HelpPanel({ schema, currentStep, isOpen, onClose }: HelpPanelProps) {
  // Persist preference when isOpen changes
  useEffect(() => {
    persistPreference(isOpen);
  }, [isOpen]);

  if (!isOpen) return null;

  const title = schema ? schema.display.name : "Import Help";

  return (
    <>
      {/* Desktop: right-side panel */}
      <aside
        className="
          hidden lg:flex lg:flex-col
          w-80 shrink-0
          bg-card border-l border-border
          h-full overflow-hidden
        "
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fa-solid fa-circle-question text-muted-foreground" />
            <span className="text-sm font-semibold truncate">{title}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            aria-label="Close help panel"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {schema ? <SchemaHelp schema={schema} currentStep={currentStep} /> : <GenericHelp />}
        </div>
      </aside>

      {/* Mobile: bottom sheet */}
      <div
        className="
          fixed inset-x-0 bottom-0 z-50
          lg:hidden
          bg-card border-t border-border
          max-h-[50vh] flex flex-col
          rounded-t-xl shadow-lg
        "
      >
        {/* Handle bar for visual affordance */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/30" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            <i className="fa-solid fa-circle-question text-muted-foreground" />
            <span className="text-sm font-semibold truncate">{title}</span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7 shrink-0"
            onClick={onClose}
            aria-label="Close help panel"
          >
            <i className="fa-solid fa-xmark text-sm" />
          </Button>
        </div>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto p-4">
          {schema ? <SchemaHelp schema={schema} currentStep={currentStep} /> : <GenericHelp />}
        </div>
      </div>
    </>
  );
}
