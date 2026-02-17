import fs from "fs";
import path from "path";
import yaml from "js-yaml";

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
  passwordSecurity?: Partial<PasswordRequirements>;
  // Future: database, etc.
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

let inMemoryConfig: PasswordRequirements | null = null;
let inMemoryAppTitle: string | null = null;
let inMemoryBaseUrl: string | null = null;
let inMemoryLogLevel: string | null = null;
let inMemoryFeatures: AppFeatures | null = null;
let inMemoryTimeline: TimelineDefaults | null = null;
let configLoaded = false;

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

// ─── YAML Writer (password section only) ────────────────────────────────────

function writeYamlConfig(requirements: PasswordRequirements): void {
  const configPath = path.join(process.cwd(), "server.config.yml");
  try {
    let config: ServerConfig = {};
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, "utf8");
      config = (yaml.load(fileContents) as ServerConfig) || {};
    }
    config.passwordSecurity = { ...requirements };
    const yamlStr = yaml.dump(config, { indent: 2, lineWidth: 80, noRefs: true });
    fs.writeFileSync(configPath, yamlStr, "utf8");
  } catch (error) {
    console.error("[Config Loader] Failed to write server.config.yml:", error);
    throw error;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load all server configuration from server.config.yml.
 * Two-tier fallback: YAML → Hardcoded defaults.
 * Call once at startup; getters auto-load if not yet initialized.
 */
export function loadServerConfig(): void {
  const yaml = readYamlFile();

  inMemoryAppTitle = yaml.app?.title ?? DEFAULT_APP_TITLE;
  inMemoryBaseUrl = yaml.app?.baseUrl ?? null;
  inMemoryLogLevel = yaml.logging?.level ?? DEFAULT_LOG_LEVEL;
  inMemoryFeatures = {
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
  inMemoryTimeline = {
    startOffset,
    endOffset,
    defaultZoom: yamlTl.defaultZoom ?? DEFAULT_TIMELINE.defaultZoom,
    defaultCompact: yamlTl.defaultCompact ?? DEFAULT_TIMELINE.defaultCompact,
    defaultTimezone: yamlTl.defaultTimezone ?? DEFAULT_TIMELINE.defaultTimezone,
    defaultDays,
  };
  inMemoryConfig = {
    ...DEFAULT_PASSWORD_REQUIREMENTS,
    ...yaml.passwordSecurity,
  };

  configLoaded = true;
  console.log("[Config Loader] Configuration loaded from server.config.yml");
}

/** Site title for browser tab, sidebar, login page */
export function getAppTitle(): string {
  if (inMemoryAppTitle === null) loadServerConfig();
  return inMemoryAppTitle!;
}

/** Base URL for auth redirects (optional — overrides Host header detection) */
export function getBaseUrl(): string | null {
  if (!configLoaded) loadServerConfig();
  return inMemoryBaseUrl;
}

/** Pino log level */
export function getLogLevel(): string {
  if (inMemoryLogLevel === null) loadServerConfig();
  return inMemoryLogLevel!;
}

/** Feature flags */
export function getFeatures(): AppFeatures {
  if (inMemoryFeatures === null) loadServerConfig();
  return inMemoryFeatures!;
}

/** Timeline/filter defaults (start/end offsets, zoom, compact, timezone) */
export function getTimelineDefaults(): TimelineDefaults {
  if (inMemoryTimeline === null) loadServerConfig();
  return inMemoryTimeline!;
}

/** Password requirements */
export function getPasswordRequirements(): PasswordRequirements {
  if (inMemoryConfig === null) loadServerConfig();
  return inMemoryConfig!;
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

  inMemoryConfig = { ...requirements };
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
