/**
 * Next.js Instrumentation Hook
 * Runs once when the Node.js server starts
 * Perfect for one-time initialization
 */

/**
 * Resolve the public base URL from BASE_URL env var or server.config.yml.
 * Normalizes the value (strips quotes, adds protocol) and injects into
 * process.env.AUTH_URL for Auth.js. If nothing is set, Auth.js falls back
 * to trustHost (derives from the request Host header).
 *
 * Resolution order: BASE_URL env → app.baseUrl YAML → trustHost auto
 */
function resolveBaseUrl(getBaseUrl: () => string | null): void {
  let raw = process.env.BASE_URL || getBaseUrl() || null;
  if (!raw) return;

  const source = process.env.BASE_URL ? "BASE_URL env" : "server.config.yml";

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
    const { loadServerConfig, getBaseUrl } = await import("@/lib/config/loader");

    // Load server configuration at startup
    loadServerConfig();
    console.log("[Instrumentation] Server configuration loaded");

    // Resolve base URL: BASE_URL env → server.config.yml → trustHost auto
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
