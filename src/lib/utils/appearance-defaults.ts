/**
 * Read YAML appearance defaults injected by ThemeScript into <head>.
 * Used by use-preferences.ts so the store defaults match server config.
 *
 * At runtime the window global is always present (ThemeScript runs
 * before React hydration). The hardcoded fallback only fires during
 * SSR or if the script tag is somehow missing.
 */

export interface AppearanceWindowDefaults {
  defaultColorMode: "light" | "dark" | "system";
  defaultThemePreset: string;
}

// Hardcoded last-resort fallback — must match DEFAULT_APPEARANCE_SETTINGS in loader.ts
const FALLBACK: AppearanceWindowDefaults = {
  defaultColorMode: "system",
  defaultThemePreset: "neutral",
};

export function getAppearanceFromWindow(): AppearanceWindowDefaults {
  if (
    typeof window !== "undefined" &&
    (window as unknown as Record<string, unknown>).__APPEARANCE_DEFAULTS__
  ) {
    return (window as unknown as Record<string, unknown>)
      .__APPEARANCE_DEFAULTS__ as AppearanceWindowDefaults;
  }
  return FALLBACK;
}
