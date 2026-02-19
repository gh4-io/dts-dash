import fs from "fs";
import path from "path";
import yaml from "js-yaml";
import { DEFAULT_CLEANUP_GRACE_HOURS } from "@/lib/data/config-defaults";

// ─── Interfaces ─────────────────────────────────────────────────────────────

export interface PasswordRequirements {
  minLength: number;
  maxLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireDigits: boolean;
  requireSpecialChars: boolean;
  preventCommon: boolean;
  minEntropy: number;
}

export interface AppFeatures {
  enableSeedEndpoint: boolean;
  cronEnabled: boolean;
}

export interface TimelineDefaults {
  startOffset: number;
  endOffset: number;
  defaultZoom: string;
  defaultCompact: boolean;
  defaultTimezone: string;
  defaultDays: number;
}

export interface FlightSettings {
  hideCanceled: boolean;
  cleanupGraceHours: number;
}

export interface AppearanceSettings {
  defaultColorMode: "light" | "dark" | "system";
  defaultThemePreset: string;
}

/** YAML shape for a single cron job override/custom definition */
export interface CronJobYamlEntry {
  name?: string;
  description?: string;
  script?: string;
  schedule?: string;
  enabled?: boolean;
  options?: Record<string, unknown>;
}

interface ServerConfig {
  app?: {
    title?: string;
    baseUrl?: string;
  };
  logging?: {
    level?: string;
  };
  features?: {
    enableSeedEndpoint?: boolean;
    cronEnabled?: boolean;
  };
  timeline?: {
    startOffset?: number;
    endOffset?: number;
    defaultZoom?: string;
    defaultCompact?: boolean;
    defaultTimezone?: string;
    defaultDays?: number;
  };
  appearance?: {
    defaultColorMode?: string;
    defaultThemePreset?: string;
  };
  flights?: Partial<FlightSettings>;
  passwordSecurity?: Partial<PasswordRequirements>;
  cron?: {
    jobs?: Record<string, CronJobYamlEntry>;
  };
}

// ─── Hardcoded Defaults ─────────────────────────────────────────────────────

const DEFAULT_APP_TITLE = "Dashboard";
const DEFAULT_LOG_LEVEL = "info";
const DEFAULT_FEATURES: AppFeatures = {
  enableSeedEndpoint: false,
  cronEnabled: true,
};
const DEFAULT_TIMELINE: TimelineDefaults = {
  startOffset: -0.5,
  endOffset: 2.5, // derived: startOffset + defaultDays (-0.5 + 3)
  defaultZoom: "3d",
  defaultCompact: false,
  defaultTimezone: "America/New_York",
  defaultDays: 3,
};
const DEFAULT_APPEARANCE_SETTINGS: AppearanceSettings = {
  defaultColorMode: "system",
  defaultThemePreset: "neutral",
};
const VALID_COLOR_MODES = ["light", "dark", "system"] as const;
const VALID_THEME_PRESETS = [
  "neutral",
  "ocean",
  "purple",
  "black",
  "vitepress",
  "dusk",
  "catppuccin",
  "solar",
  "emerald",
  "ruby",
  "aspen",
] as const;
const DEFAULT_FLIGHT_SETTINGS: FlightSettings = {
  hideCanceled: true,
  cleanupGraceHours: DEFAULT_CLEANUP_GRACE_HOURS,
};
const DEFAULT_PASSWORD_REQUIREMENTS: PasswordRequirements = {
  minLength: 12,
  maxLength: 128,
  requireUppercase: true,
  requireLowercase: true,
  requireDigits: true,
  requireSpecialChars: true,
  preventCommon: true,
  minEntropy: 50,
};

// ─── In-Memory State ────────────────────────────────────────────────────────
// Use globalThis so state survives across code-split chunks in Next.js builds.
// Without this, each dynamic-import chunk gets its own module instance with
// null state, causing redundant config reloads.

interface ServerConfigState {
  inMemoryConfig: PasswordRequirements | null;
  inMemoryAppTitle: string | null;
  inMemoryBaseUrl: string | null;
  inMemoryLogLevel: string | null;
  inMemoryFeatures: AppFeatures | null;
  inMemoryTimeline: TimelineDefaults | null;
  inMemoryFlights: FlightSettings | null;
  inMemoryAppearance: AppearanceSettings | null;
  configLoaded: boolean;
}

const STATE_KEY = "__serverConfig" as const;

function getState(): ServerConfigState {
  const g = globalThis as Record<string, unknown>;
  if (!g[STATE_KEY]) {
    g[STATE_KEY] = {
      inMemoryConfig: null,
      inMemoryAppTitle: null,
      inMemoryBaseUrl: null,
      inMemoryLogLevel: null,
      inMemoryFeatures: null,
      inMemoryTimeline: null,
      inMemoryFlights: null,
      inMemoryAppearance: null,
      configLoaded: false,
    };
  }
  return g[STATE_KEY] as ServerConfigState;
}

// ─── YAML Reader ─────────────────────────────────────────────────────────────

function readYamlFile(): ServerConfig {
  const configPath = path.join(process.cwd(), "server.config.yml");
  try {
    if (!fs.existsSync(configPath)) return {};
    const fileContents = fs.readFileSync(configPath, "utf8");
    return (yaml.load(fileContents) as ServerConfig) || {};
  } catch (error) {
    console.warn("[Config Loader] Failed to load server.config.yml:", error);
    return {};
  }
}

// ─── YAML Writer ─────────────────────────────────────────────────────────────

/** Read-merge-write a section of server.config.yml */
function writeYamlSection(mutator: (config: ServerConfig) => void): void {
  const configPath = path.join(process.cwd(), "server.config.yml");
  try {
    let config: ServerConfig = {};
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, "utf8");
      config = (yaml.load(fileContents) as ServerConfig) || {};
    }
    mutator(config);
    const yamlStr = yaml.dump(config, { indent: 2, lineWidth: 80, noRefs: true });
    fs.writeFileSync(configPath, yamlStr, "utf8");
  } catch (error) {
    console.error("[Config Loader] Failed to write server.config.yml:", error);
    throw error;
  }
}

function writeYamlConfig(requirements: PasswordRequirements): void {
  writeYamlSection((config) => {
    config.passwordSecurity = { ...requirements };
  });
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load all server configuration from server.config.yml.
 * Two-tier fallback: YAML → Hardcoded defaults.
 * Call once at startup; getters auto-load if not yet initialized.
 */
export function loadServerConfig(force = false): void {
  const s = getState();
  if (s.configLoaded && !force) return;

  const yaml = readYamlFile();

  s.inMemoryAppTitle = yaml.app?.title ?? DEFAULT_APP_TITLE;
  s.inMemoryBaseUrl = yaml.app?.baseUrl ?? null;
  s.inMemoryLogLevel = yaml.logging?.level ?? DEFAULT_LOG_LEVEL;
  s.inMemoryFeatures = {
    enableSeedEndpoint: yaml.features?.enableSeedEndpoint ?? DEFAULT_FEATURES.enableSeedEndpoint,
    cronEnabled: yaml.features?.cronEnabled ?? DEFAULT_FEATURES.cronEnabled,
  };
  const yamlTl = yaml.timeline ?? {};
  const startOffset = yamlTl.startOffset ?? DEFAULT_TIMELINE.startOffset;
  const defaultDays = yamlTl.defaultDays ?? DEFAULT_TIMELINE.defaultDays;
  // If BOTH offsets are explicitly set, use them and ignore defaultDays.
  // Otherwise derive endOffset = startOffset + defaultDays.
  const bothExplicit = yamlTl.startOffset !== undefined && yamlTl.endOffset !== undefined;
  const endOffset = bothExplicit ? yamlTl.endOffset! : startOffset + defaultDays;
  s.inMemoryTimeline = {
    startOffset,
    endOffset,
    defaultZoom: yamlTl.defaultZoom ?? DEFAULT_TIMELINE.defaultZoom,
    defaultCompact: yamlTl.defaultCompact ?? DEFAULT_TIMELINE.defaultCompact,
    defaultTimezone: yamlTl.defaultTimezone ?? DEFAULT_TIMELINE.defaultTimezone,
    defaultDays,
  };
  const yamlFlights = yaml.flights ?? {};
  s.inMemoryFlights = {
    hideCanceled: yamlFlights.hideCanceled ?? DEFAULT_FLIGHT_SETTINGS.hideCanceled,
    cleanupGraceHours: yamlFlights.cleanupGraceHours ?? DEFAULT_FLIGHT_SETTINGS.cleanupGraceHours,
  };
  s.inMemoryConfig = {
    ...DEFAULT_PASSWORD_REQUIREMENTS,
    ...yaml.passwordSecurity,
  };

  // ── Appearance ──
  const yamlAppearance = yaml.appearance ?? {};
  const rawColorMode = yamlAppearance.defaultColorMode;
  const rawPreset = yamlAppearance.defaultThemePreset;
  s.inMemoryAppearance = {
    defaultColorMode:
      rawColorMode && (VALID_COLOR_MODES as readonly string[]).includes(rawColorMode)
        ? (rawColorMode as AppearanceSettings["defaultColorMode"])
        : DEFAULT_APPEARANCE_SETTINGS.defaultColorMode,
    defaultThemePreset:
      rawPreset && (VALID_THEME_PRESETS as readonly string[]).includes(rawPreset)
        ? rawPreset
        : DEFAULT_APPEARANCE_SETTINGS.defaultThemePreset,
  };

  s.configLoaded = true;
  console.log("[Config Loader] Configuration loaded from server.config.yml");
}

/** Site title for browser tab, sidebar, login page */
export function getAppTitle(): string {
  const s = getState();
  if (s.inMemoryAppTitle === null) loadServerConfig();
  return s.inMemoryAppTitle!;
}

/** Base URL for auth redirects (optional — overrides Host header detection) */
export function getBaseUrl(): string | null {
  const s = getState();
  if (!s.configLoaded) loadServerConfig();
  return s.inMemoryBaseUrl;
}

/** Pino log level */
export function getLogLevel(): string {
  const s = getState();
  if (s.inMemoryLogLevel === null) loadServerConfig();
  return s.inMemoryLogLevel!;
}

/** Feature flags */
export function getFeatures(): AppFeatures {
  const s = getState();
  if (s.inMemoryFeatures === null) loadServerConfig();
  return s.inMemoryFeatures!;
}

/** Timeline/filter defaults (start/end offsets, zoom, compact, timezone) */
export function getTimelineDefaults(): TimelineDefaults {
  const s = getState();
  if (s.inMemoryTimeline === null) loadServerConfig();
  return s.inMemoryTimeline!;
}

/** Flight display + cleanup settings */
export function getFlightSettings(): FlightSettings {
  const s = getState();
  if (s.inMemoryFlights === null) loadServerConfig();
  return s.inMemoryFlights!;
}

/** System appearance defaults (color mode + theme preset) */
export function getAppearanceDefaults(): AppearanceSettings {
  const s = getState();
  if (s.inMemoryAppearance === null) loadServerConfig();
  return s.inMemoryAppearance!;
}

/**
 * Update flight settings — writes to server.config.yml and updates memory.
 * Used by Admin UI when saving settings.
 */
export function updateFlightSettings(settings: FlightSettings): void {
  if (typeof settings.hideCanceled !== "boolean") {
    throw new Error("hideCanceled must be a boolean");
  }
  if (
    typeof settings.cleanupGraceHours !== "number" ||
    !Number.isInteger(settings.cleanupGraceHours) ||
    settings.cleanupGraceHours < 1 ||
    settings.cleanupGraceHours > 720
  ) {
    throw new Error("cleanupGraceHours must be an integer between 1 and 720");
  }

  getState().inMemoryFlights = { ...settings };
  writeYamlSection((config) => {
    config.flights = { ...settings };
  });

  console.log("[Config Loader] Flight settings updated");
}

/** Password requirements */
export function getPasswordRequirements(): PasswordRequirements {
  const s = getState();
  if (s.inMemoryConfig === null) loadServerConfig();
  return s.inMemoryConfig!;
}

/**
 * Update password requirements — writes to server.config.yml and updates memory.
 * Used by Admin UI when saving settings.
 */
export function updatePasswordRequirements(requirements: PasswordRequirements): void {
  if (
    requirements.minLength < 8 ||
    requirements.minLength > 128 ||
    requirements.maxLength < 8 ||
    requirements.maxLength > 128 ||
    requirements.minLength > requirements.maxLength
  ) {
    throw new Error("Invalid password length requirements (must be 8-128, min <= max)");
  }
  if (requirements.minEntropy < 0 || requirements.minEntropy > 100) {
    throw new Error("Invalid minEntropy (must be 0-100)");
  }

  getState().inMemoryConfig = { ...requirements };
  writeYamlConfig(requirements);

  console.log("[Config Loader] Password requirements updated");
}

/**
 * Get the source of current password requirements.
 * Returns "yaml" if any field is set in server.config.yml, otherwise "default".
 */
export function getPasswordRequirementsSource(): {
  source: "yaml" | "default";
  details: Record<string, "yaml" | "default">;
} {
  const yamlConfig = readYamlFile().passwordSecurity ?? {};
  const fields: (keyof PasswordRequirements)[] = [
    "minLength",
    "maxLength",
    "requireUppercase",
    "requireLowercase",
    "requireDigits",
    "requireSpecialChars",
    "preventCommon",
    "minEntropy",
  ];

  const details: Record<string, "yaml" | "default"> = {};
  for (const field of fields) {
    details[field] = yamlConfig[field] !== undefined ? "yaml" : "default";
  }

  const hasYaml = Object.values(details).some((s) => s === "yaml");
  return { source: hasYaml ? "yaml" : "default", details };
}

// ─── Cron Job Overrides ────────────────────────────────────────────────────

/** Get raw cron.jobs overrides from YAML (empty object if none) */
export function getCronJobOverrides(): Record<string, CronJobYamlEntry> {
  const yamlConfig = readYamlFile();
  return yamlConfig.cron?.jobs ?? {};
}

/**
 * Write the full cron.jobs section to YAML.
 * Pass the complete overrides map; it replaces the entire cron.jobs block.
 */
export function updateCronJobOverrides(overrides: Record<string, CronJobYamlEntry>): void {
  writeYamlSection((config) => {
    if (!config.cron) config.cron = {};
    // Strip empty objects to keep YAML clean
    const cleaned: Record<string, CronJobYamlEntry> = {};
    for (const [key, entry] of Object.entries(overrides)) {
      if (Object.keys(entry).length > 0) {
        cleaned[key] = entry;
      }
    }
    if (Object.keys(cleaned).length > 0) {
      config.cron.jobs = cleaned;
    } else {
      delete config.cron.jobs;
      if (Object.keys(config.cron).length === 0) delete config.cron;
    }
  });
  console.log("[Config Loader] Cron job overrides updated");
}
