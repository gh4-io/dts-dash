"use client";

/**
 * Import Hub — Main orchestrator
 *
 * State machine for the import wizard.
 * Data-first mode: shows file upload/paste as the landing view.
 * Auto-detects schema via `_importType` key, defaults to work-packages.
 * Toolbar + stepper + steps + help panel + history.
 */

import { useCallback, useEffect, useState, useRef } from "react";
import { useSearchParams } from "next/navigation";
import type {
  SerializableSchema,
  FieldMapping,
  ValidationPreview,
  CommitResult,
} from "@/lib/import/types";
import { ImportToolbar } from "./import-toolbar";
import { ImportStepper } from "./import-stepper";
import { StepSelectType } from "./step-select-type";
import { StepLoadData } from "./step-load-data";
import { StepFieldMapping } from "./step-field-mapping";
import { StepValidation } from "./step-validation";
import { StepConfirmImport } from "./step-confirm-import";
import { StepResults } from "./step-results";
import { HelpPanel } from "./help-panel";
import { ImportHistory } from "./import-history";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type WizardStep = 1 | 2 | 3 | 4 | 5 | 6;

interface WizardState {
  step: WizardStep;
  schemaId: string | null;
  schema: SerializableSchema | null;
  content: string;
  fileName?: string;
  format: "json" | "csv" | null;
  sourceFields: string[];
  mapping: FieldMapping[];
  previewRows: Record<string, unknown>[];
  validation: ValidationPreview | null;
  commitResult: CommitResult | null;
  source: "file" | "paste";
  /** Data-first mode: data-load is the landing view instead of type grid */
  dataFirstMode: boolean;
  /** Toggle to show the type selection grid in data-first mode */
  showTypeGrid: boolean;
  /** Schema ID detected from _importType key (null if explicit or not attempted) */
  autoDetectedSchemaId: string | null;
}

const INITIAL_STATE: WizardState = {
  step: 1,
  schemaId: null,
  schema: null,
  content: "",
  fileName: undefined,
  format: null,
  sourceFields: [],
  mapping: [],
  previewRows: [],
  validation: null,
  commitResult: null,
  source: "file",
  dataFirstMode: true,
  showTypeGrid: false,
  autoDetectedSchemaId: null,
};

const STEPS = [
  { label: "Select Type", icon: "fa-solid fa-database" },
  { label: "Load Data", icon: "fa-solid fa-upload" },
  { label: "Map Fields", icon: "fa-solid fa-arrows-left-right" },
  { label: "Validate", icon: "fa-solid fa-check-double" },
  { label: "Confirm", icon: "fa-solid fa-shield-check" },
  { label: "Results", icon: "fa-solid fa-flag-checkered" },
];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function ImportHub() {
  const searchParams = useSearchParams();
  const [schemas, setSchemas] = useState<SerializableSchema[]>([]);
  const [state, setState] = useState<WizardState>(INITIAL_STATE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const initialTypeHandled = useRef(false);

  // Fetch schemas on mount
  useEffect(() => {
    fetch("/api/admin/import/schemas")
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load schemas (${r.status})`);
        return r.json();
      })
      .then((data) => setSchemas(data.schemas || []))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load schemas"));
  }, []);

  // Handle ?type= query param to pre-select a schema (stays on data-load in data-first mode)
  useEffect(() => {
    if (initialTypeHandled.current || schemas.length === 0) return;
    const typeParam = searchParams.get("type");
    if (typeParam) {
      const schema = schemas.find((s) => s.id === typeParam);
      if (schema) {
        setState((prev) => ({
          ...prev,
          step: 1,
          schemaId: schema.id,
          schema,
          dataFirstMode: true,
        }));
        initialTypeHandled.current = true;
      }
    }
  }, [schemas, searchParams]);

  // Load help panel preference from localStorage
  useEffect(() => {
    const saved = localStorage.getItem("import-hub-help-open");
    if (saved === "true") setHelpOpen(true);
  }, []);

  // Persist help panel preference
  const toggleHelp = useCallback(() => {
    setHelpOpen((prev) => {
      const next = !prev;
      localStorage.setItem("import-hub-help-open", String(next));
      return next;
    });
  }, []);

  // Reset wizard to data-first landing
  const resetWizard = useCallback(() => {
    setState(INITIAL_STATE);
    setError(null);
  }, []);

  // Clear error on step navigation
  const clearError = useCallback(() => setError(null), []);

  // -----------------------------------------------------------------------
  // Step 1 (data-first): Load Data → Parse (with optional/auto schema)
  // -----------------------------------------------------------------------
  const handleContentChange = useCallback((content: string, fileName?: string) => {
    setState((prev) => ({
      ...prev,
      content,
      fileName: fileName || prev.fileName,
      source: fileName ? "file" : "paste",
    }));
  }, []);

  /**
   * Parse in data-first mode: schemaId may be null → API auto-detects.
   * Always resolves to a schema (explicit _importType or work-packages default).
   */
  const handleDataFirstParse = useCallback(async () => {
    if (!state.content.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId: state.schemaId, // may be null → triggers auto-detection
          content: state.content,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Parse failed (${res.status})`);
      }

      const data = await res.json();
      const resolvedSchemaId = data.schemaId;
      const schema = schemas.find((s) => s.id === resolvedSchemaId) || null;

      setState((prev) => ({
        ...prev,
        step: 3,
        schemaId: resolvedSchemaId,
        schema,
        format: data.detectedFormat,
        sourceFields: data.sourceFields,
        mapping: data.suggestedMapping,
        previewRows: [],
        autoDetectedSchemaId: data.detectedSchemaId,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse data");
    } finally {
      setLoading(false);
    }
  }, [state.schemaId, state.content, schemas]);

  // -----------------------------------------------------------------------
  // Type Selection (data-first toggle or traditional step 1)
  // -----------------------------------------------------------------------
  // Toggle type grid on/off (for toolbar Import button)
  const handleToggleTypeGrid = useCallback(() => {
    setState((prev) => ({ ...prev, showTypeGrid: !prev.showTypeGrid }));
    setError(null);
  }, []);

  const handleSelectType = useCallback(
    async (schemaId: string) => {
      const schema = schemas.find((s) => s.id === schemaId) || null;

      if (state.content.trim() && state.dataFirstMode) {
        // Data already loaded — select type and parse immediately
        setState((prev) => ({
          ...prev,
          schemaId,
          schema,
          showTypeGrid: false,
        }));

        setLoading(true);
        setError(null);
        try {
          const res = await fetch("/api/admin/import/parse", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ schemaId, content: state.content }),
          });
          if (!res.ok) {
            const err = await res.json().catch(() => ({}));
            throw new Error((err as { error?: string }).error || `Parse failed (${res.status})`);
          }
          const data = await res.json();
          setState((prev) => ({
            ...prev,
            step: 3,
            format: data.detectedFormat,
            sourceFields: data.sourceFields,
            mapping: data.suggestedMapping,
            previewRows: [],
            autoDetectedSchemaId: null,
          }));
        } catch (err) {
          setError(err instanceof Error ? err.message : "Failed to parse data");
        } finally {
          setLoading(false);
        }
      } else {
        // No data loaded — go to data-load view with schema pre-selected
        setState((prev) => ({
          ...prev,
          step: 1,
          schemaId,
          schema,
          showTypeGrid: false,
          dataFirstMode: true,
        }));
        setError(null);
      }
    },
    [schemas, state.content, state.dataFirstMode],
  );

  // -----------------------------------------------------------------------
  // Step 2: Load Data → Parse (traditional flow, schema already selected)
  // -----------------------------------------------------------------------
  const handleParse = useCallback(async () => {
    if (!state.schemaId || !state.content.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId: state.schemaId,
          content: state.content,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Parse failed (${res.status})`);
      }

      const data = await res.json();

      setState((prev) => ({
        ...prev,
        step: 3,
        format: data.detectedFormat,
        sourceFields: data.sourceFields,
        mapping: data.suggestedMapping,
        previewRows: [],
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to parse data");
    } finally {
      setLoading(false);
    }
  }, [state.schemaId, state.content]);

  // -----------------------------------------------------------------------
  // Step 3: Field Mapping → Validate
  // -----------------------------------------------------------------------
  const handleAutoMap = useCallback(async () => {
    if (!state.schemaId || !state.content.trim()) return;

    // Re-call parse to get fresh auto-mapping
    try {
      const res = await fetch("/api/admin/import/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId: state.schemaId,
          content: state.content,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setState((prev) => ({
          ...prev,
          mapping: data.suggestedMapping,
        }));
      }
    } catch {
      // Auto-map is a convenience action; silent failure is acceptable
    }
  }, [state.schemaId, state.content]);

  const handleValidate = useCallback(async () => {
    if (!state.schemaId || !state.content.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId: state.schemaId,
          content: state.content,
          format: state.format,
          fieldMapping: state.mapping,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Validation failed (${res.status})`);
      }

      const data: ValidationPreview = await res.json();

      setState((prev) => ({
        ...prev,
        step: 4,
        validation: data,
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Validation request failed");
    } finally {
      setLoading(false);
    }
  }, [state.schemaId, state.content, state.format, state.mapping]);

  // -----------------------------------------------------------------------
  // Step 4: Validation → Confirm
  // -----------------------------------------------------------------------
  const handleProceedToConfirm = useCallback(() => {
    setState((prev) => ({ ...prev, step: 5 }));
  }, []);

  // -----------------------------------------------------------------------
  // Step 5: Confirm → Commit
  // -----------------------------------------------------------------------
  const handleCommit = useCallback(async () => {
    if (!state.schemaId || !state.content.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/import/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          schemaId: state.schemaId,
          content: state.content,
          format: state.format,
          fieldMapping: state.mapping,
          source: state.source,
          fileName: state.fileName,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error((err as { error?: string }).error || `Import failed (${res.status})`);
      }

      const data: CommitResult = await res.json();

      setState((prev) => ({
        ...prev,
        step: 6,
        commitResult: data,
      }));

      // Refresh history
      setHistoryTrigger((prev) => prev + 1);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import commit failed");
    } finally {
      setLoading(false);
    }
  }, [state.schemaId, state.content, state.format, state.mapping, state.source, state.fileName]);

  // -----------------------------------------------------------------------
  // Navigation: Back from step 3 goes to data-load (step 1 in data-first)
  // -----------------------------------------------------------------------
  const handleBackFromMapping = useCallback(() => {
    if (state.dataFirstMode) {
      setState((prev) => ({
        ...prev,
        step: 1,
        showTypeGrid: false,
        sourceFields: [],
        mapping: [],
      }));
    } else {
      setState((prev) => ({ ...prev, step: 2 }));
    }
  }, [state.dataFirstMode]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const currentSchema = state.schema;

  // In data-first mode: show stepper from step 3+ (steps 1-2 are merged into landing)
  // In traditional mode: show stepper from step 2+
  const showStepper = state.dataFirstMode ? state.step >= 3 : state.step > 1;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <ImportToolbar
        schemas={schemas}
        onStartImport={resetWizard}
        onToggleHelp={toggleHelp}
        helpOpen={helpOpen}
        showTypeGrid={state.showTypeGrid}
        onToggleTypeGrid={
          state.step === 1 && state.dataFirstMode ? handleToggleTypeGrid : undefined
        }
      />

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-3 rounded-md border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          <i className="fa-solid fa-circle-exclamation shrink-0" />
          <span className="flex-1">{error}</span>
          <button
            onClick={clearError}
            className="shrink-0 text-destructive/70 hover:text-destructive"
          >
            <i className="fa-solid fa-xmark" />
          </button>
        </div>
      )}

      {/* Auto-detected schema info badge */}
      {state.autoDetectedSchemaId && state.step >= 3 && currentSchema && (
        <div className="flex items-center gap-2 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-sm text-emerald-600 dark:text-emerald-400">
          <i className="fa-solid fa-wand-magic-sparkles" />
          <span>
            Auto-detected: <strong>{currentSchema.display.name}</strong>
          </span>
        </div>
      )}

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Wizard area */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Stepper */}
          {showStepper && <ImportStepper currentStep={state.step} steps={STEPS} />}

          {/* Step 1: Data-first mode → show data-load or type grid */}
          {state.step === 1 && state.dataFirstMode && !state.showTypeGrid && (
            <StepLoadData
              schema={currentSchema}
              content={state.content}
              onContentChange={handleContentChange}
              onNext={handleDataFirstParse}
              onBack={resetWizard}
              loading={loading}
              dataFirstMode
              schemas={schemas}
            />
          )}

          {/* Type grid (toggled via Import/Types button in toolbar) */}
          {state.step === 1 && state.showTypeGrid && (
            <StepSelectType schemas={schemas} onSelect={handleSelectType} />
          )}

          {/* Step 1: Traditional mode (fallback, shouldn't normally reach) */}
          {state.step === 1 && !state.dataFirstMode && !state.showTypeGrid && (
            <StepSelectType schemas={schemas} onSelect={handleSelectType} />
          )}

          {/* Step 2: Traditional Load Data (schema already selected) */}
          {state.step === 2 && currentSchema && (
            <StepLoadData
              schema={currentSchema}
              content={state.content}
              onContentChange={handleContentChange}
              onNext={handleParse}
              onBack={resetWizard}
              loading={loading}
            />
          )}

          {state.step === 3 && currentSchema && (
            <StepFieldMapping
              schema={currentSchema}
              sourceFields={state.sourceFields}
              mapping={state.mapping}
              previewRows={state.previewRows}
              onMappingChange={(mapping) => setState((prev) => ({ ...prev, mapping }))}
              onAutoMap={handleAutoMap}
              onNext={handleValidate}
              onBack={handleBackFromMapping}
              loading={loading}
            />
          )}

          {state.step === 4 && state.validation && (
            <StepValidation
              validation={state.validation}
              onNext={handleProceedToConfirm}
              onBack={() => setState((prev) => ({ ...prev, step: 3 }))}
            />
          )}

          {state.step === 5 && currentSchema && state.validation && (
            <StepConfirmImport
              schema={currentSchema}
              validation={state.validation}
              mapping={state.mapping}
              source={state.source}
              fileName={state.fileName}
              onConfirm={handleCommit}
              onBack={() => setState((prev) => ({ ...prev, step: 4 }))}
              loading={loading}
            />
          )}

          {state.step === 6 && state.commitResult && (
            <StepResults result={state.commitResult} onImportMore={resetWizard} />
          )}
        </div>

        {/* Help panel */}
        {helpOpen && (
          <HelpPanel
            schema={currentSchema}
            currentStep={state.step}
            isOpen={helpOpen}
            onClose={() => {
              setHelpOpen(false);
              localStorage.setItem("import-hub-help-open", "false");
            }}
          />
        )}
      </div>

      {/* History (always visible below wizard) */}
      <div className="border-t border-border pt-6">
        <ImportHistory refreshTrigger={historyTrigger} />
      </div>
    </div>
  );
}
