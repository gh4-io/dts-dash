import { createChildLogger } from "@/lib/logger";

const log = createChildLogger("env-check");

const DEV_DEFAULTS = [
  "dev-secret-change-in-production-minimum-32-chars",
  "changeme",
  "secret",
  "dev-secret",
  "development",
];

const MIN_SECRET_LENGTH = 32;

export function validateAuthSecret(): void {
  // Skip during next build — validation runs at server startup only
  if (process.env.NEXT_PHASE === "phase-production-build") return;

  const secret = process.env.AUTH_SECRET;
  const isProd = process.env.NODE_ENV === "production";

  if (!secret) {
    if (isProd) {
      log.fatal(
        "AUTH_SECRET is not set. Set auth.secret in server.config.yml or AUTH_SECRET env var. " +
          "Generate with: npm run generate-secret",
      );
      process.exit(1);
    }
    log.warn(
      "AUTH_SECRET is not set. Set auth.secret in server.config.yml or AUTH_SECRET env var. " +
        "This is OK for development but must be set in production.",
    );
    return;
  }

  if (isProd) {
    if (secret.length < MIN_SECRET_LENGTH) {
      log.fatal(
        `AUTH_SECRET must be at least ${MIN_SECRET_LENGTH} characters (current: ${secret.length}). ` +
          "Generate with: npm run generate-secret",
      );
      process.exit(1);
    }

    if (DEV_DEFAULTS.some((d) => secret.toLowerCase().includes(d))) {
      log.fatal(
        "AUTH_SECRET contains a development placeholder. " +
          "Generate a production secret with: npm run generate-secret",
      );
      process.exit(1);
    }
  }
}
