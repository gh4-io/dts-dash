/**
 * Next.js Instrumentation Hook
 * Runs once when the Node.js server starts
 * Perfect for one-time initialization
 */

export async function register() {
  // Skip during production build — only run at server startup
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  // Only run on server-side
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadServerConfig, getBaseUrl } = await import("@/lib/config/loader");

    // Load server configuration at startup
    loadServerConfig();
    console.log("[Instrumentation] Server configuration loaded");

    // Inject AUTH_URL from config if set (and not already in env)
    const baseUrl = getBaseUrl();
    if (baseUrl && !process.env.AUTH_URL) {
      process.env.AUTH_URL = baseUrl;
      console.log(`[Instrumentation] AUTH_URL set from server.config.yml: ${baseUrl}`);
    }

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
