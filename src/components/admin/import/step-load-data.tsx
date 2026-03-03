"use client";

/**
 * Step: Load Data
 *
 * Textarea + file upload for raw data input.
 * In data-first mode (schema=null), shows generic format hints
 * and an info button to browse available import types.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import type { SerializableSchema } from "@/lib/import/types";

interface StepLoadDataProps {
  schema: SerializableSchema | null;
  content: string;
  onContentChange: (content: string, fileName?: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading?: boolean;
  /** Whether we're in data-first mode (no step 1 type selection) */
  dataFirstMode?: boolean;
  /** All available schemas (for the info popover) */
  schemas?: SerializableSchema[];
}

export function StepLoadData({
  schema,
  content,
  onContentChange,
  onNext,
  onBack,
  loading,
  dataFirstMode,
  schemas,
}: StepLoadDataProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFileSelect = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setFileName(file.name);
      onContentChange(text, file.name);
    };
    reader.readAsText(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  };

  const formatHint = schema ? schema.formats.join(" or ").toUpperCase() : "JSON or CSV";
  const maxSizeMB = schema?.maxSizeMB || 50;

  // Group schemas by category for the info popover
  const schemasByCategory: Record<string, SerializableSchema[]> = {};
  if (schemas) {
    for (const s of schemas) {
      const cat = s.display.category;
      if (!schemasByCategory[cat]) schemasByCategory[cat] = [];
      schemasByCategory[cat].push(s);
    }
  }
  const categoryOrder = ["Operations", "Master Data", "Administration", "Configuration"];
  const sortedCategories = Object.keys(schemasByCategory).sort(
    (a, b) =>
      (categoryOrder.indexOf(a) === -1 ? 99 : categoryOrder.indexOf(a)) -
      (categoryOrder.indexOf(b) === -1 ? 99 : categoryOrder.indexOf(b)),
  );

  return (
    <div className="space-y-4">
      {/* Schema indicator (data-first mode) */}
      {dataFirstMode && (
        <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2.5">
          {schema ? (
            <>
              <i className={`${schema.display.icon} text-primary`} />
              <span className="text-sm font-medium">{schema.display.name}</span>
              <span className="text-xs text-muted-foreground">selected</span>
            </>
          ) : (
            <>
              <i className="fa-solid fa-wand-magic-sparkles text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Defaults to Work Packages. Add{" "}
                <code className="rounded bg-muted px-1 text-xs font-mono">_importType</code> field
                to specify type.
              </span>
            </>
          )}
          {/* Info button — shows all available types */}
          {schemas && schemas.length > 0 && (
            <Popover>
              <PopoverTrigger asChild>
                <button
                  type="button"
                  className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  title="Available import types"
                >
                  <i className="fa-solid fa-circle-info text-sm" />
                </button>
              </PopoverTrigger>
              <PopoverContent align="end" className="w-80 max-h-96 overflow-y-auto p-0">
                <div className="border-b border-border px-4 py-3">
                  <p className="text-sm font-medium">Available Import Types</p>
                  <p className="text-xs text-muted-foreground">
                    Use <code className="rounded bg-muted px-1 font-mono">_importType</code> value
                    in your data
                  </p>
                </div>
                <div className="divide-y divide-border">
                  {sortedCategories.map((cat) => (
                    <div key={cat} className="px-4 py-2.5">
                      <p className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {cat}
                      </p>
                      <div className="space-y-1.5">
                        {schemasByCategory[cat].map((s) => (
                          <div key={s.id} className="flex items-start gap-2">
                            <i
                              className={`${s.display.icon} mt-0.5 w-4 text-center text-xs text-muted-foreground`}
                            />
                            <div className="min-w-0">
                              <p className="text-xs font-medium leading-tight">{s.display.name}</p>
                              <p className="text-[10px] leading-tight text-muted-foreground">
                                <code className="font-mono">{s.id}</code>
                                {" — "}
                                {s.display.description}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          )}
        </div>
      )}

      {/* File drop zone */}
      <div
        className={`relative rounded-lg border-2 border-dashed p-6 text-center transition-colors ${
          dragOver
            ? "border-primary bg-primary/5"
            : "border-border hover:border-muted-foreground/50"
        }`}
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        <div className="space-y-2">
          <i className="fa-solid fa-cloud-arrow-up text-2xl text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Drag & drop a {formatHint} file here, or{" "}
            <button
              type="button"
              className="text-primary underline"
              onClick={() => fileInputRef.current?.click()}
            >
              browse
            </button>
          </p>
          {fileName && (
            <p className="text-xs text-muted-foreground">
              <i className="fa-solid fa-file mr-1" />
              {fileName}
            </p>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,.csv,.txt"
          className="hidden"
          onChange={handleFileInput}
        />
      </div>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted-foreground">or paste content</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Paste textarea */}
      <textarea
        className="min-h-[200px] w-full rounded-lg border border-border bg-muted/50 p-3 font-mono text-xs focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
        placeholder={`Paste your ${formatHint} data here...`}
        value={content}
        onChange={(e) => {
          setFileName(null);
          onContentChange(e.target.value);
        }}
      />

      {/* Size info */}
      {content && (
        <p className="text-xs text-muted-foreground">
          {(new Blob([content]).size / 1024).toFixed(1)} KB
          {maxSizeMB && ` / ${maxSizeMB} MB max`}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end pt-2">
        {!dataFirstMode && (
          <Button variant="outline" onClick={onBack} className="mr-auto">
            <i className="fa-solid fa-arrow-left mr-2" />
            Back
          </Button>
        )}
        <Button onClick={onNext} disabled={!content.trim() || loading}>
          {loading ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Parsing...
            </>
          ) : (
            <>
              Next
              <i className="fa-solid fa-arrow-right ml-2" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
