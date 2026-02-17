/**
 * Next.js Instrumentation Hook
 * Runs once when the Node.js server starts
 * Perfect for one-time initialization
 */

export async function register() {
  // Only run on server-side
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { loadServerConfig } = await import("@/lib/config/loader");

    // Load server configuration at startup
    loadServerConfig();
    console.log("[Instrumentation] Server configuration loaded");

    // Start cron scheduler
    const { startCron } = await import("@/lib/cron");
    startCron();
  }
}
