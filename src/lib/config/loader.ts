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

interface ServerConfig {
  passwordSecurity?: Partial<PasswordRequirements>;
  // Future: database, logging, features, etc.
}

// ─── Hardcoded Defaults ─────────────────────────────────────────────────────

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

// ─── Helper Functions ───────────────────────────────────────────────────────

/**
 * Load password requirements from environment variables (fallback tier 2)
 */
function loadPasswordEnvConfig(): Partial<PasswordRequirements> {
  const envConfig: Partial<PasswordRequirements> = {};

  if (process.env.PASSWORD_MIN_LENGTH) {
    const val = parseInt(process.env.PASSWORD_MIN_LENGTH, 10);
    if (!isNaN(val) && val >= 8 && val <= 128) {
      envConfig.minLength = val;
    }
  }

  if (process.env.PASSWORD_MAX_LENGTH) {
    const val = parseInt(process.env.PASSWORD_MAX_LENGTH, 10);
    if (!isNaN(val) && val >= 8 && val <= 128) {
      envConfig.maxLength = val;
    }
  }

  if (process.env.PASSWORD_REQUIRE_UPPERCASE !== undefined) {
    envConfig.requireUppercase = process.env.PASSWORD_REQUIRE_UPPERCASE !== "false";
  }

  if (process.env.PASSWORD_REQUIRE_LOWERCASE !== undefined) {
    envConfig.requireLowercase = process.env.PASSWORD_REQUIRE_LOWERCASE !== "false";
  }

  if (process.env.PASSWORD_REQUIRE_DIGITS !== undefined) {
    envConfig.requireDigits = process.env.PASSWORD_REQUIRE_DIGITS !== "false";
  }

  if (process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== undefined) {
    envConfig.requireSpecialChars = process.env.PASSWORD_REQUIRE_SPECIAL_CHARS !== "false";
  }

  if (process.env.PASSWORD_PREVENT_COMMON !== undefined) {
    envConfig.preventCommon = process.env.PASSWORD_PREVENT_COMMON !== "false";
  }

  if (process.env.PASSWORD_MIN_ENTROPY) {
    const val = parseInt(process.env.PASSWORD_MIN_ENTROPY, 10);
    if (!isNaN(val) && val >= 0 && val <= 100) {
      envConfig.minEntropy = val;
    }
  }

  return envConfig;
}

/**
 * Load server config from YAML file (tier 1)
 */
function loadYamlConfig(): Partial<PasswordRequirements> {
  const configPath = path.join(process.cwd(), "server.config.yml");

  try {
    if (!fs.existsSync(configPath)) {
      return {};
    }

    const fileContents = fs.readFileSync(configPath, "utf8");
    const config = yaml.load(fileContents) as ServerConfig;

    return config.passwordSecurity || {};
  } catch (error) {
    console.warn("[Config Loader] Failed to load YAML config:", error);
    return {};
  }
}

/**
 * Write updated password requirements to YAML file
 */
function writeYamlConfig(requirements: PasswordRequirements): void {
  const configPath = path.join(process.cwd(), "server.config.yml");

  try {
    // Load existing config or start fresh
    let config: ServerConfig = {};
    if (fs.existsSync(configPath)) {
      const fileContents = fs.readFileSync(configPath, "utf8");
      config = (yaml.load(fileContents) as ServerConfig) || {};
    }

    // Update passwordSecurity section
    config.passwordSecurity = {
      minLength: requirements.minLength,
      maxLength: requirements.maxLength,
      requireUppercase: requirements.requireUppercase,
      requireLowercase: requirements.requireLowercase,
      requireDigits: requirements.requireDigits,
      requireSpecialChars: requirements.requireSpecialChars,
      preventCommon: requirements.preventCommon,
      minEntropy: requirements.minEntropy,
    };

    // Write back to file
    const yamlStr = yaml.dump(config, {
      indent: 2,
      lineWidth: 80,
      noRefs: true,
    });

    fs.writeFileSync(configPath, yamlStr, "utf8");
  } catch (error) {
    console.error("[Config Loader] Failed to write YAML config:", error);
    throw error;
  }
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Load server configuration at startup
 * Three-tier fallback: YAML → ENV → Defaults
 */
export function loadServerConfig(): void {
  const yamlConfig = loadYamlConfig();
  const envConfig = loadPasswordEnvConfig();

  // Merge with priority: YAML > ENV > Defaults
  inMemoryConfig = {
    ...DEFAULT_PASSWORD_REQUIREMENTS,
    ...envConfig,
    ...yamlConfig,
  };

  console.log(
    "[Config Loader] Password requirements loaded:",
    JSON.stringify(inMemoryConfig, null, 2),
  );
}

/**
 * Get current password requirements from in-memory config
 * Call loadServerConfig() first at app startup
 */
export function getPasswordRequirements(): PasswordRequirements {
  if (!inMemoryConfig) {
    // Auto-load if not initialized (should not happen in production)
    console.warn("[Config Loader] Auto-loading config (should be called at startup)");
    loadServerConfig();
  }

  return inMemoryConfig!;
}

/**
 * Update password requirements (updates memory + writes to YAML file)
 * Used by Admin UI when saving settings
 */
export function updatePasswordRequirements(requirements: PasswordRequirements): void {
  // Validate inputs
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

  // Update in-memory state (instant application)
  inMemoryConfig = { ...requirements };

  // Persist to YAML file (for next startup)
  writeYamlConfig(requirements);

  console.log(
    "[Config Loader] Password requirements updated:",
    JSON.stringify(inMemoryConfig, null, 2),
  );
}

/**
 * Get source metadata (for Admin UI display)
 * Returns which tier provided each setting
 */
export function getPasswordRequirementsSource(): {
  source: "yaml" | "env" | "default";
  details: Record<string, "yaml" | "env" | "default">;
} {
  const yamlConfig = loadYamlConfig();
  const envConfig = loadPasswordEnvConfig();

  const details: Record<string, "yaml" | "env" | "default"> = {};

  // Check source for each field
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

  for (const field of fields) {
    if (yamlConfig[field] !== undefined) {
      details[field] = "yaml";
    } else if (envConfig[field] !== undefined) {
      details[field] = "env";
    } else {
      details[field] = "default";
    }
  }

  // Determine overall source (if any field is from YAML, return YAML)
  const hasYaml = Object.values(details).some((s) => s === "yaml");
  const hasEnv = Object.values(details).some((s) => s === "env");

  const source: "yaml" | "env" | "default" = hasYaml ? "yaml" : hasEnv ? "env" : "default";

  return { source, details };
}
