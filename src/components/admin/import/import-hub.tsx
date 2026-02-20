"use client";

/**
 * Import Hub — Main orchestrator
 *
 * State machine for the 6-step import wizard.
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
  const [helpOpen, setHelpOpen] = useState(false);
  const [historyTrigger, setHistoryTrigger] = useState(0);
  const initialTypeHandled = useRef(false);

  // Fetch schemas on mount
  useEffect(() => {
    fetch("/api/admin/import/schemas")
      .then((r) => r.json())
      .then((data) => setSchemas(data.schemas || []))
      .catch(() => {});
  }, []);

  // Handle ?type= query param to pre-select a schema
  useEffect(() => {
    if (initialTypeHandled.current || schemas.length === 0) return;
    const typeParam = searchParams.get("type");
    if (typeParam) {
      const schema = schemas.find((s) => s.id === typeParam);
      if (schema) {
        setState((prev) => ({
          ...prev,
          step: 2,
          schemaId: schema.id,
          schema,
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

  // Reset wizard to step 1
  const resetWizard = useCallback(() => {
    setState(INITIAL_STATE);
  }, []);

  // -----------------------------------------------------------------------
  // Step 1: Select Type
  // -----------------------------------------------------------------------
  const handleSelectType = useCallback(
    (schemaId: string) => {
      const schema = schemas.find((s) => s.id === schemaId) || null;
      setState((prev) => ({
        ...prev,
        step: 2,
        schemaId,
        schema,
      }));
    },
    [schemas],
  );

  // -----------------------------------------------------------------------
  // Step 2: Load Data → Parse
  // -----------------------------------------------------------------------
  const handleContentChange = useCallback((content: string, fileName?: string) => {
    setState((prev) => ({
      ...prev,
      content,
      fileName: fileName || prev.fileName,
      source: fileName ? "file" : "paste",
    }));
  }, []);

  const handleParse = useCallback(async () => {
    if (!state.schemaId || !state.content.trim()) return;

    setLoading(true);
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
        const err = await res.json();
        throw new Error(err.error || "Parse failed");
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
    } catch {
      // Error shown in UI
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
      // Silent
    }
  }, [state.schemaId, state.content]);

  const handleValidate = useCallback(async () => {
    if (!state.schemaId || !state.content.trim()) return;

    setLoading(true);
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

      const data: ValidationPreview = await res.json();

      setState((prev) => ({
        ...prev,
        step: 4,
        validation: data,
      }));
    } catch {
      // Error shown in UI
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

      const data: CommitResult = await res.json();

      setState((prev) => ({
        ...prev,
        step: 6,
        commitResult: data,
      }));

      // Refresh history
      setHistoryTrigger((prev) => prev + 1);
    } catch {
      // Error shown in UI
    } finally {
      setLoading(false);
    }
  }, [state.schemaId, state.content, state.format, state.mapping, state.source, state.fileName]);

  // -----------------------------------------------------------------------
  // Render
  // -----------------------------------------------------------------------

  const currentSchema = state.schema;

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <ImportToolbar
        schemas={schemas}
        onStartImport={resetWizard}
        onToggleHelp={toggleHelp}
        helpOpen={helpOpen}
      />

      {/* Main content area */}
      <div className="flex gap-6">
        {/* Wizard area */}
        <div className="min-w-0 flex-1 space-y-6">
          {/* Stepper (visible on steps 2-6) */}
          {state.step > 1 && <ImportStepper currentStep={state.step} steps={STEPS} />}

          {/* Step content */}
          {state.step === 1 && <StepSelectType schemas={schemas} onSelect={handleSelectType} />}

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
              onBack={() => setState((prev) => ({ ...prev, step: 2 }))}
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
