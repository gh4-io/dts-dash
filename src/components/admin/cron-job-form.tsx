"use client";

import { useState, useEffect, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CronScheduleBuilder } from "./cron-schedule-builder";
import type { CronJobRow } from "./cron-job-table";

interface BuiltinDef {
  key: string;
  name: string;
  description: string;
  script: string;
  defaultSchedule: string;
  defaultEnabled: boolean;
  defaultOptions: Record<string, unknown>;
  optionsSchema: Record<
    string,
    {
      type: "number" | "string" | "boolean";
      default: unknown;
      label: string;
      min?: number;
      max?: number;
      description?: string;
    }
  >;
}

interface CronJobFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: "create" | "edit";
  initialData?: CronJobRow;
  builtinDefs: BuiltinDef[];
  onSubmit: (data: {
    key: string;
    name: string;
    description: string;
    script: string;
    schedule: string;
    enabled: boolean;
    options: Record<string, unknown>;
  }) => Promise<void>;
  onReset?: () => void;
}

function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export function CronJobForm({
  open,
  onOpenChange,
  mode,
  initialData,
  builtinDefs,
  onSubmit,
  onReset,
}: CronJobFormProps) {
  const [key, setKey] = useState("");
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [script, setScript] = useState("");
  const [schedule, setSchedule] = useState("0 */6 * * *");
  const [enabled, setEnabled] = useState(true);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [autoKey, setAutoKey] = useState(true);

  const builtinDef = initialData?.builtin
    ? builtinDefs.find((b) => b.key === initialData.key)
    : undefined;

  useEffect(() => {
    if (open) {
      setError(null);
      setSaving(false);
      if (mode === "edit" && initialData) {
        setKey(initialData.key);
        setName(initialData.name);
        setDescription(initialData.description);
        setScript(initialData.script);
        setSchedule(initialData.schedule);
        setEnabled(initialData.enabled);
        setOptions({ ...initialData.options });
        setAutoKey(false);
      } else {
        setKey("");
        setName("");
        setDescription("");
        setScript("");
        setSchedule("0 0 * * *");
        setEnabled(true);
        setOptions({});
        setAutoKey(true);
      }
    }
  }, [open, mode, initialData]);

  const handleNameChange = (val: string) => {
    setName(val);
    if (autoKey && mode === "create") {
      setKey(slugify(val));
    }
  };

  const handleScheduleChange = useCallback((expr: string) => {
    setSchedule(expr);
  }, []);

  const handleOptionChange = (optKey: string, value: unknown) => {
    setOptions((prev) => ({ ...prev, [optKey]: value }));
  };

  const handleSubmit = async () => {
    setError(null);
    setSaving(true);
    try {
      await onSubmit({ key, name, description, script, schedule, enabled, options });
      onOpenChange(false);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const isBuiltin = initialData?.builtin === true;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Custom Job" : `Edit: ${initialData?.name ?? ""}`}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {error && (
            <div className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive">
              {error}
            </div>
          )}

          {/* Key */}
          <div>
            <Label>Key</Label>
            {mode === "create" ? (
              <Input
                value={key}
                onChange={(e) => {
                  setKey(e.target.value);
                  setAutoKey(false);
                }}
                placeholder="my-task"
                className="font-mono"
              />
            ) : (
              <Input value={key} disabled className="font-mono opacity-60" />
            )}
            <p className="mt-0.5 text-[10px] text-muted-foreground">
              Unique identifier (kebab-case)
            </p>
          </div>

          {/* Name */}
          <div>
            <Label>Name</Label>
            <Input
              value={name}
              onChange={(e) => handleNameChange(e.target.value)}
              placeholder="My Task"
              disabled={isBuiltin}
            />
          </div>

          {/* Description */}
          <div>
            <Label>Description</Label>
            <Input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What this job does..."
              disabled={isBuiltin}
            />
          </div>

          {/* Script */}
          <div>
            <Label>Script Path</Label>
            <Input
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="scripts/cron/my-task.ts"
              className="font-mono"
              disabled={isBuiltin}
            />
            {isBuiltin && (
              <p className="mt-0.5 text-[10px] text-muted-foreground">
                Built-in script (read-only)
              </p>
            )}
          </div>

          {/* Schedule */}
          <div>
            <Label>Schedule</Label>
            <CronScheduleBuilder value={schedule} onChange={handleScheduleChange} />
          </div>

          {/* Enabled */}
          <div className="flex items-center gap-3">
            <Switch checked={enabled} onCheckedChange={setEnabled} id="cron-enabled" />
            <Label htmlFor="cron-enabled" className="cursor-pointer">
              Enabled
            </Label>
          </div>

          {/* Options */}
          {builtinDef &&
          builtinDef.optionsSchema &&
          Object.keys(builtinDef.optionsSchema).length > 0 ? (
            <div className="space-y-3">
              <Label className="text-sm font-medium">Options</Label>
              {Object.entries(builtinDef.optionsSchema).map(([optKey, schema]) => (
                <div key={optKey}>
                  <Label className="text-xs">{schema.label}</Label>
                  {schema.type === "number" ? (
                    <Input
                      type="number"
                      min={schema.min}
                      max={schema.max}
                      value={
                        options[optKey] !== undefined
                          ? Number(options[optKey])
                          : Number(schema.default)
                      }
                      onChange={(e) => handleOptionChange(optKey, Number(e.target.value))}
                    />
                  ) : schema.type === "boolean" ? (
                    <div className="flex items-center gap-2 pt-1">
                      <Switch
                        checked={
                          options[optKey] !== undefined
                            ? Boolean(options[optKey])
                            : Boolean(schema.default)
                        }
                        onCheckedChange={(v) => handleOptionChange(optKey, v)}
                      />
                    </div>
                  ) : (
                    <Input
                      value={String(options[optKey] ?? schema.default ?? "")}
                      onChange={(e) => handleOptionChange(optKey, e.target.value)}
                    />
                  )}
                  {schema.description && (
                    <p className="mt-0.5 text-[10px] text-muted-foreground">{schema.description}</p>
                  )}
                </div>
              ))}
            </div>
          ) : !isBuiltin && mode === "edit" && Object.keys(options).length > 0 ? (
            <div className="space-y-2">
              <Label className="text-sm font-medium">Options</Label>
              {Object.entries(options).map(([optKey, val]) => (
                <div key={optKey} className="grid grid-cols-2 gap-2">
                  <Input value={optKey} disabled className="font-mono text-xs" />
                  <Input
                    value={String(val ?? "")}
                    onChange={(e) => handleOptionChange(optKey, e.target.value)}
                    className="text-xs"
                  />
                </div>
              ))}
            </div>
          ) : null}
        </div>

        <DialogFooter className="flex items-center gap-2">
          {isBuiltin && onReset && (
            <Button type="button" variant="outline" size="sm" onClick={onReset} className="mr-auto">
              <i className="fa-solid fa-rotate-left mr-1.5" />
              Reset to Defaults
            </Button>
          )}
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={saving}>
            {saving && <i className="fa-solid fa-spinner fa-spin mr-1.5" />}
            {mode === "create" ? "Create" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
