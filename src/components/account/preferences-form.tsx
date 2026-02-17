"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { usePreferences, type ThemePreset, type ColorMode } from "@/lib/hooks/use-preferences";

const THEME_PRESETS: { value: ThemePreset; label: string; description: string }[] = [
  { value: "neutral", label: "Neutral", description: "Default zinc/gray tones" },
  { value: "ocean", label: "Ocean", description: "Cool blue tones" },
  { value: "purple", label: "Purple", description: "Soft lavender tones" },
  { value: "black", label: "Black", description: "True-black surfaces" },
  { value: "vitepress", label: "Vitepress", description: "Green accent, docs style" },
  { value: "dusk", label: "Dusk", description: "Warm twilight tones" },
  { value: "catppuccin", label: "Catppuccin", description: "Pastel warm tones" },
  { value: "solar", label: "Solar", description: "Gold/amber solarized" },
  { value: "emerald", label: "Emerald", description: "Green forest tones" },
  { value: "ruby", label: "Ruby", description: "Red/crimson accent" },
  { value: "aspen", label: "Aspen", description: "Earth tones, natural warmth" },
];

const COLOR_MODES: { value: ColorMode; label: string; icon: string }[] = [
  { value: "light", label: "Light", icon: "fa-solid fa-sun" },
  { value: "dark", label: "Dark", icon: "fa-solid fa-moon" },
  { value: "system", label: "System", icon: "fa-solid fa-circle-half-stroke" },
];

const DATE_RANGES = [
  { value: "1d", label: "1 Day" },
  { value: "3d", label: "3 Days" },
  { value: "1w", label: "1 Week" },
];

const PAGE_SIZES = [10, 25, 30, 50, 100];

export function PreferencesForm() {
  const { setTheme } = useTheme();
  const prefs = usePreferences();

  // Sync color mode with next-themes
  useEffect(() => {
    if (prefs.loaded) {
      setTheme(prefs.colorMode);
    }
  }, [prefs.colorMode, prefs.loaded, setTheme]);

  const handleColorModeChange = (mode: ColorMode) => {
    setTheme(mode);
    prefs.update({ colorMode: mode });
  };

  const handlePresetChange = (preset: ThemePreset) => {
    prefs.update({ themePreset: preset });
  };

  const handleAccentClear = () => {
    prefs.update({ accentColor: null });
  };

  return (
    <div className="space-y-8">
      {/* ─── Appearance ─────────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <i className="fa-solid fa-palette mr-2" />
          Appearance
        </h3>

        <div className="space-y-2">
          <Label>Color Mode</Label>
          <div className="flex gap-2">
            {COLOR_MODES.map((mode) => (
              <Button
                key={mode.value}
                variant={prefs.colorMode === mode.value ? "default" : "outline"}
                size="sm"
                onClick={() => handleColorModeChange(mode.value)}
              >
                <i className={`${mode.icon} mr-2`} />
                {mode.label}
              </Button>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          <Label>Theme Preset</Label>
          <Select
            value={prefs.themePreset}
            onValueChange={(v) => handlePresetChange(v as ThemePreset)}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {THEME_PRESETS.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  <span className="font-medium">{t.label}</span>
                  <span className="ml-2 text-muted-foreground text-xs">{t.description}</span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {prefs.accentColor && (
          <div className="space-y-2">
            <Label>Accent Color Override</Label>
            <div className="flex items-center gap-2">
              <div
                className="h-8 w-8 rounded border border-border"
                style={{ backgroundColor: `hsl(${prefs.accentColor})` }}
              />
              <span className="text-sm text-muted-foreground">{prefs.accentColor}</span>
              <Button variant="ghost" size="sm" onClick={handleAccentClear}>
                <i className="fa-solid fa-xmark mr-1" />
                Clear
              </Button>
            </div>
          </div>
        )}

        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="compact-mode">Compact Mode</Label>
            <p className="text-xs text-muted-foreground">Reduce spacing in tables and lists</p>
          </div>
          <Switch
            id="compact-mode"
            checked={prefs.compactMode}
            onCheckedChange={(checked) => prefs.update({ compactMode: checked })}
          />
        </div>
      </section>

      {/* ─── Notifications (vNext stubs) ────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <i className="fa-solid fa-bell mr-2" />
          Notifications
          <span className="ml-2 rounded-full bg-muted px-2 py-0.5 text-[10px] font-normal">
            Coming Soon
          </span>
        </h3>

        <div className="space-y-3 opacity-50 pointer-events-none">
          {[
            { label: "Email — Transactional", defaultOn: true },
            { label: "Email — System Alerts", defaultOn: true },
            { label: "Push Notifications", defaultOn: false },
            { label: "SMS Notifications", defaultOn: false },
          ].map((n) => (
            <div key={n.label} className="flex items-center justify-between">
              <Label>{n.label}</Label>
              <Switch checked={n.defaultOn} disabled />
            </div>
          ))}
        </div>
      </section>

      {/* ─── Data Display ───────────────────────────────────────────── */}
      <section className="space-y-4">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          <i className="fa-solid fa-table-columns mr-2" />
          Data Display
        </h3>

        <div className="space-y-2">
          <Label>Default Timezone</Label>
          <Select
            value={prefs.defaultTimezone}
            onValueChange={(v) => prefs.update({ defaultTimezone: v })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="UTC">UTC</SelectItem>
              <SelectItem value="America/New_York">Eastern (America/New_York)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Default Date Range</Label>
          <Select
            value={prefs.defaultDateRange ?? undefined}
            onValueChange={(v) => prefs.update({ defaultDateRange: v as "1d" | "3d" | "1w" })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((r) => (
                <SelectItem key={r.value} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-2">
          <Label>Table Page Size</Label>
          <Select
            value={String(prefs.tablePageSize)}
            onValueChange={(v) => prefs.update({ tablePageSize: parseInt(v, 10) })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAGE_SIZES.map((s) => (
                <SelectItem key={s} value={String(s)}>
                  {s} rows
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </section>
    </div>
  );
}
