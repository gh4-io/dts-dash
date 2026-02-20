"use client";

/**
 * Step 2: Load Data
 *
 * Textarea + file upload for raw data input.
 */

import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import type { SerializableSchema } from "@/lib/import/types";

interface StepLoadDataProps {
  schema: SerializableSchema;
  content: string;
  onContentChange: (content: string, fileName?: string) => void;
  onNext: () => void;
  onBack: () => void;
  loading?: boolean;
}

export function StepLoadData({
  schema,
  content,
  onContentChange,
  onNext,
  onBack,
  loading,
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

  const formatHint = schema.formats.join(" or ").toUpperCase();

  return (
    <div className="space-y-4">
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
          {schema.maxSizeMB && ` / ${schema.maxSizeMB} MB max`}
        </p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <Button variant="outline" onClick={onBack}>
          <i className="fa-solid fa-arrow-left mr-2" />
          Back
        </Button>
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
