"use client";

import { useState, useCallback, useMemo, useRef } from "react";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CapacityAssumptions } from "@/types";

interface AssumptionsFormProps {
  initial: CapacityAssumptions;
  onSave: (updates: Partial<CapacityAssumptions>) => Promise<void>;
}

/**
 * Opt-in click-to-edit config for percentage SliderFields. Values are stored as
 * decimal fractions (0-1) but typed as whole percents, so both edges convert.
 * The 4-decimal round keeps 89 -> 0.89 exact instead of 0.8899999999999999.
 */
const PERCENT_EDIT: SliderFieldEdit = {
  suffix: "%",
  toInput: (v) => `${(v * 100).toFixed(0)}`,
  fromInput: (raw) => {
    const n = Number(raw.trim().replace("%", ""));
    if (raw.trim() === "" || !Number.isFinite(n)) return null;
    return parseFloat((n / 100).toFixed(4));
  },
};

export function AssumptionsForm({ initial, onSave }: AssumptionsFormProps) {
  const [paidToAvailable, setPaidToAvailable] = useState(initial.paidToAvailable);
  const [availableToProductive, setAvailableToProductive] = useState(initial.availableToProductive);
  const [nightProductivityFactor, setNightProductivityFactor] = useState(
    initial.nightProductivityFactor,
  );
  const [defaultMhNoWp, setDefaultMhNoWp] = useState(initial.defaultMhNoWp);
  const [demandCurve, setDemandCurve] = useState(initial.demandCurve);
  const [arrivalWeight, setArrivalWeight] = useState(initial.arrivalWeight);
  const [departureWeight, setDepartureWeight] = useState(initial.departureWeight);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  // Live preview calculations
  const preview = useMemo(() => {
    const dayMH = 8.0 * availableToProductive;
    const nightMH = dayMH * nightProductivityFactor;
    const overallEfficiency = paidToAvailable * availableToProductive;
    return {
      dayMH,
      nightMH,
      overallEfficiency,
      weightSum: arrivalWeight + departureWeight,
      weightValid: arrivalWeight + departureWeight <= 1.0,
    };
  }, [
    paidToAvailable,
    availableToProductive,
    nightProductivityFactor,
    arrivalWeight,
    departureWeight,
  ]);

  const isDirty =
    paidToAvailable !== initial.paidToAvailable ||
    availableToProductive !== initial.availableToProductive ||
    nightProductivityFactor !== initial.nightProductivityFactor ||
    defaultMhNoWp !== initial.defaultMhNoWp ||
    demandCurve !== initial.demandCurve ||
    arrivalWeight !== initial.arrivalWeight ||
    departureWeight !== initial.departureWeight;

  const handleSave = useCallback(async () => {
    setSaving(true);
    setMessage(null);
    try {
      await onSave({
        paidToAvailable,
        availableToProductive,
        nightProductivityFactor,
        defaultMhNoWp,
        demandCurve,
        arrivalWeight,
        departureWeight,
      });
      setMessage({ type: "success", text: "Assumptions saved successfully" });
    } catch (err) {
      setMessage({ type: "error", text: (err as Error).message });
    } finally {
      setSaving(false);
    }
  }, [
    paidToAvailable,
    availableToProductive,
    nightProductivityFactor,
    defaultMhNoWp,
    demandCurve,
    arrivalWeight,
    departureWeight,
    onSave,
  ]);

  return (
    <div className="space-y-6">
      {message && (
        <div
          className={`rounded-md px-4 py-3 text-sm ${
            message.type === "success"
              ? "bg-emerald-500/10 text-emerald-500"
              : "bg-destructive/10 text-destructive"
          }`}
        >
          {message.text}
        </div>
      )}

      {/* Live preview card */}
      <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-4">
        <div className="flex items-center gap-2 text-sm font-medium text-emerald-400 mb-3">
          <i className="fa-solid fa-calculator" />
          Live Preview
        </div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {preview.dayMH.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              <i className="fa-solid fa-sun text-amber-400 mr-1" />
              Day/Swing MH/person
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {preview.nightMH.toFixed(2)}
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              <i className="fa-solid fa-moon text-indigo-400 mr-1" />
              Night MH/person
            </div>
          </div>
          <div>
            <div className="text-2xl font-bold tabular-nums text-foreground">
              {(preview.overallEfficiency * 100).toFixed(1)}%
            </div>
            <div className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">
              Overall Efficiency
            </div>
          </div>
        </div>
        <div className="mt-2 text-[10px] text-muted-foreground text-center">
          Heads x {paidToAvailable.toFixed(2)} (attendance) = eff. heads | 8.0h x{" "}
          {availableToProductive.toFixed(2)} = {preview.dayMH.toFixed(2)} MH/eff. person (Day)
          {" | "}x {nightProductivityFactor.toFixed(2)} = {preview.nightMH.toFixed(2)} MH/eff.
          person (Night)
        </div>
      </div>

      {/* Productivity Factors */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-gauge-high mr-2 text-muted-foreground" />
          Productivity Factors
        </h2>

        <SliderField
          label="Attendance Rate"
          description="What % of scheduled staff actually show up? Accounts for call-offs, sick leave, vacation."
          value={paidToAvailable}
          onChange={setPaidToAvailable}
          min={0.5}
          max={1.0}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          editable={PERCENT_EDIT}
        />

        <SliderField
          label="Available-to-Productive"
          description="What % of available time is productive wrench-turning? Excludes breaks, admin, travel."
          value={availableToProductive}
          onChange={setAvailableToProductive}
          min={0.3}
          max={1.0}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          editable={PERCENT_EDIT}
        />

        <SliderField
          label="Night Productivity Factor"
          description="Night shift efficiency multiplier. Applied on top of available-to-productive for NIGHT shift."
          value={nightProductivityFactor}
          onChange={setNightProductivityFactor}
          min={0.5}
          max={1.0}
          step={0.01}
          format={(v) => `${(v * 100).toFixed(0)}%`}
          editable={PERCENT_EDIT}
        />

        {/* These two factors multiply — 89% x 65% is 58%, not 89% or 65%. That is
            easy to mis-read as a single ratio, so spell the chain out with the
            current numbers rather than leaving it to be inferred. */}
        <div className="rounded-md border border-border bg-muted/30 p-3 space-y-2">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            <i className="fa-solid fa-circle-info mr-1.5" />
            How productive MH is calculated
          </div>

          <div className="font-mono text-xs text-foreground">
            HC x HOURS x ATT x PROD <span className="text-muted-foreground">[x NIGHT]</span> =
            Productive MH
          </div>

          <div className="font-mono text-[11px] text-muted-foreground">
            e.g. 8 heads x 10h x {paidToAvailable.toFixed(2)} x {availableToProductive.toFixed(2)} ={" "}
            <span className="text-foreground font-medium">
              {(8 * 10 * paidToAvailable * availableToProductive).toFixed(1)} MH
            </span>
          </div>

          <dl className="grid grid-cols-[auto_1fr] gap-x-2 gap-y-1 text-[11px] text-muted-foreground pt-1">
            <dt className="font-mono text-foreground">HC x HOURS</dt>
            <dd>
              <span className="text-foreground">Paid MH</span> — everyone rostered, at their shift
              length. What payroll covers.
            </dd>

            <dt className="font-mono text-foreground">x ATT</dt>
            <dd>
              <span className="text-foreground">Available MH</span> — attendance rate. Removes
              call-offs, sick leave, vacation.
            </dd>

            <dt className="font-mono text-foreground">x PROD</dt>
            <dd>
              <span className="text-foreground">Productive MH</span> — wrench time. Removes breaks,
              admin, travel.
            </dd>

            <dt className="font-mono text-foreground">x NIGHT</dt>
            <dd>Night shifts only, applied on top of PROD.</dd>
          </dl>

          <p className="text-[11px] text-muted-foreground border-t border-border pt-2">
            Combined efficiency is{" "}
            <span className="font-mono text-foreground">
              {(paidToAvailable * availableToProductive * 100).toFixed(1)}%
            </span>{" "}
            of paid hours — the two factors multiply, they do not average. Productive MH is what
            capacity and utilisation are measured against; Paid and Available MH are reported for
            reference.
          </p>
        </div>
      </section>

      {/* Default MH */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-hammer mr-2 text-muted-foreground" />
          Demand Settings
        </h2>

        <SliderField
          label="Default MH (no WP data)"
          description="Fallback man-hours when a work package has no MH value. Used for approximately 77% of WPs."
          value={defaultMhNoWp}
          onChange={setDefaultMhNoWp}
          min={0.5}
          max={10}
          step={0.5}
          format={(v) => `${v.toFixed(1)} MH`}
        />
      </section>

      {/* Demand Curve */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-5">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-chart-area mr-2 text-muted-foreground" />
          Demand Curve
        </h2>
        <p className="text-xs text-muted-foreground">
          Controls how MH is distributed across ground-time shift slots. EVEN distributes equally;
          WEIGHTED adds extra MH at arrival and departure shifts.
        </p>

        <div className="space-y-2">
          <Label className="text-xs text-muted-foreground">Curve Type</Label>
          <Select
            value={demandCurve}
            onValueChange={(v) => setDemandCurve(v as "EVEN" | "WEIGHTED")}
          >
            <SelectTrigger className="w-[200px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="EVEN">Even Distribution</SelectItem>
              <SelectItem value="WEIGHTED">Weighted (Arrival/Departure)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {demandCurve === "WEIGHTED" && (
          <>
            <SliderField
              label="Arrival Weight"
              description="Extra MH allocated to the arrival shift (receiving inspection, intake)."
              value={arrivalWeight}
              onChange={setArrivalWeight}
              min={0}
              max={0.5}
              step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />

            <SliderField
              label="Departure Weight"
              description="Extra MH allocated to the departure shift (release checks, signoff)."
              value={departureWeight}
              onChange={setDepartureWeight}
              min={0}
              max={0.5}
              step={0.05}
              format={(v) => `${(v * 100).toFixed(0)}%`}
            />

            {!preview.weightValid && (
              <div className="rounded-md border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
                <i className="fa-solid fa-triangle-exclamation mr-1" />
                Arrival + Departure weights ({(preview.weightSum * 100).toFixed(0)}%) exceed 100%.
                Cannot save.
              </div>
            )}
          </>
        )}
      </section>

      {/* Save button */}
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {isDirty ? "Unsaved changes" : "No changes"}
        </span>
        <Button
          onClick={handleSave}
          disabled={saving || !isDirty || !preview.weightValid}
          size="sm"
        >
          {saving ? (
            <>
              <i className="fa-solid fa-spinner fa-spin mr-2" />
              Saving...
            </>
          ) : (
            <>
              <i className="fa-solid fa-floppy-disk mr-2" />
              Save Assumptions
            </>
          )}
        </Button>
      </div>
    </div>
  );
}

/**
 * Opt-in click-to-edit behaviour for a SliderField's value display. Omit it and
 * the value stays a plain read-only label (the `format` output is unchanged).
 */
interface SliderFieldEdit {
  /** Stored value -> raw text shown while editing (e.g. 0.89 -> "89") */
  toInput: (v: number) => string;
  /** Typed text -> stored value; return null to reject and restore the previous value */
  fromInput: (raw: string) => number | null;
  /** Unit rendered beside the input while editing */
  suffix?: string;
}

/** Reusable slider field with label, description, and value display */
function SliderField({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  format,
  editable,
}: {
  label: string;
  description: string;
  value: number;
  onChange: (v: number) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  editable?: SliderFieldEdit;
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  // Set by Escape so the blur that follows unmounting the input does not commit
  const cancelledRef = useRef(false);

  const startEdit = useCallback(() => {
    if (!editable) return;
    cancelledRef.current = false;
    setDraft(editable.toInput(value));
    setEditing(true);
  }, [editable, value]);

  const commit = useCallback(() => {
    if (!editable || cancelledRef.current) {
      setEditing(false);
      return;
    }
    const parsed = editable.fromInput(draft);
    // Non-numeric or empty input falls back to the previous value rather than NaN
    if (parsed !== null) onChange(Math.min(max, Math.max(min, parsed)));
    setEditing(false);
  }, [editable, draft, onChange, min, max]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="text-sm">{label}</Label>
        {editing && editable ? (
          <div className="flex items-center gap-1">
            <Input
              autoFocus
              inputMode="decimal"
              aria-label={label}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onFocus={(e) => e.target.select()}
              onBlur={commit}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  commit();
                } else if (e.key === "Escape") {
                  e.preventDefault();
                  cancelledRef.current = true;
                  setEditing(false);
                }
              }}
              className="h-7 w-20 text-right text-sm font-mono tabular-nums font-medium"
            />
            {editable.suffix && (
              <span className="text-sm font-mono text-muted-foreground">{editable.suffix}</span>
            )}
          </div>
        ) : editable ? (
          <button
            type="button"
            onClick={startEdit}
            aria-label={`Edit ${label}`}
            className="rounded px-1 text-sm font-mono tabular-nums font-medium hover:bg-accent focus-visible:ring-ring/50 focus-visible:ring-[3px] outline-none"
          >
            {format(value)}
          </button>
        ) : (
          <span className="text-sm font-mono tabular-nums font-medium">{format(value)}</span>
        )}
      </div>
      <Slider
        value={[value]}
        onValueChange={([v]) => onChange(v)}
        min={min}
        max={max}
        step={step}
      />
      <p className="text-[11px] text-muted-foreground">{description}</p>
    </div>
  );
}
