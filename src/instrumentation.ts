/**
 * Next.js Instrumentation Hook
 * Runs once when the Node.js server starts
 * Perfect for one-time initialization
 */

/**
 * Resolve the public base URL from server.config.yml or BASE_URL env.
 * Normalizes the value (strips quotes, adds protocol) and injects into
 * process.env.AUTH_URL for Auth.js. If nothing is set, Auth.js falls back
 * to trustHost (derives from the request Host header).
 *
 * Resolution order: app.baseUrl YAML → BASE_URL env → trustHost auto
 */
function resolveBaseUrl(getBaseUrl: () => string | null): void {
  const yamlBaseUrl = getBaseUrl();
  let raw = yamlBaseUrl || process.env.BASE_URL || null;
  if (!raw) return;

  const source = yamlBaseUrl ? "server.config.yml" : "BASE_URL env";

  // Strip surrounding quotes (common Docker env quoting mistake)
  const stripped = raw.replace(/^["']|["']$/g, "");
  if (stripped !== raw) {
    console.warn(
      `[Instrumentation] baseUrl from ${source} contained quotes — stripped: "${raw}" → "${stripped}"`,
    );
    raw = stripped;
  }

  // Prepend https:// if no protocol
  if (!raw.includes("://")) {
    raw = `https://${raw}`;
    console.log(`[Instrumentation] baseUrl had no protocol — prepended https://: "${raw}"`);
  }

  // Validate
  try {
    new URL(raw);
    process.env.AUTH_URL = raw;
    console.log(`[Instrumentation] baseUrl set from ${source}: ${raw}`);
  } catch {
    console.error(
      `[Instrumentation] baseUrl "${raw}" from ${source} is not a valid URL — skipping. ` +
        `Auth.js will derive the URL from the request Host header (trustHost).`,
    );
  }
}

export async function register() {
  // Skip during production build — only run at server startup
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Only run on server-side
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadServerConfig, getBaseUrl, getConfigPath, ensureAuthSecret, getDatabasePath } =
      await import("@/lib/config/loader");

    // Load server configuration at startup
    loadServerConfig();
    const configFile = getConfigPath();
    console.log(
      `[Instrumentation] Configuration loaded from ${configFile ?? "defaults (no config file)"}`,
    );

    // Resolve AUTH_SECRET: YAML > env > auto-generate
    // Must run before auth.ts module loads (sets process.env.AUTH_SECRET)
    ensureAuthSecret();

    // Resolve DATABASE_PATH: YAML > env > default
    // Must run before db/client.ts module loads (sets process.env.DATABASE_PATH)
    const dbPath = getDatabasePath();
    if (dbPath !== process.env.DATABASE_PATH) {
      process.env.DATABASE_PATH = dbPath;
      console.log(`[Instrumentation] DATABASE_PATH set to: ${dbPath}`);
    }

    // Resolve base URL: server.config.yml → BASE_URL env → trustHost auto
    resolveBaseUrl(getBaseUrl);

    // Bootstrap database (schema + system user + default config)
    const { bootstrapDatabase } = await import("@/lib/db/bootstrap");
    bootstrapDatabase();
    console.log("[Instrumentation] Database bootstrap complete");

    // Start cron scheduler
    const { startCron } = await import("@/lib/cron");
    startCron();
    console.log("[Instrumentation] Startup sequence complete");
  }
}
