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
import {
  usePreferences,
  type ThemePreset,
  type ColorMode,
  type TimeFormat,
} from "@/lib/hooks/use-preferences";

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

export default function SettingsPage() {
  const { setTheme } = useTheme();
  const prefs = usePreferences();

  useEffect(() => {
    if (!prefs.loaded) {
      prefs.fetch();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs.loaded]);

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
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-2xl font-bold">
        <i className="fa-solid fa-gear mr-2" />
        Settings
      </h1>

      {/* ─── Appearance ─────────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-palette mr-2 text-muted-foreground" />
          Appearance
        </h2>

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

      {/* ─── Data Display ───────────────────────────────────────────── */}
      <section className="rounded-lg border border-border bg-card p-6 space-y-4">
        <h2 className="text-lg font-semibold">
          <i className="fa-solid fa-table-columns mr-2 text-muted-foreground" />
          Data Display
        </h2>

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
          <Label>Time Format</Label>
          <Select
            value={prefs.timeFormat}
            onValueChange={(v) => prefs.update({ timeFormat: v as TimeFormat })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="12h">12-Hour (2:00 PM)</SelectItem>
              <SelectItem value="24h">24-Hour (14:00)</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-xs text-muted-foreground">
            Applies to chart axes, bar labels, tooltips, and date pickers
          </p>
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
