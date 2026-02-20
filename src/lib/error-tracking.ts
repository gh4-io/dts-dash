import { createChildLogger } from "./logger";

const log = createChildLogger("error-tracking");

interface ErrorContext {
  module?: string;
  action?: string;
  userId?: string;
  [key: string]: unknown;
}

/**
 * Capture an exception for error tracking.
 * Default: logs via pino.
 * With SENTRY_DSN env var: forwards to Sentry (optional dependency).
 */
export function captureException(
  error: unknown,
  context?: ErrorContext
): void {
  const err = error instanceof Error ? error : new Error(String(error));

  // Always log locally
  log.error({ err, ...context }, `Unhandled error in ${context?.module || "unknown"}`);

  // Forward to Sentry if configured
  if (process.env.SENTRY_DSN) {
    try {
      // Dynamic import — Sentry is an optional dependency
      // @ts-expect-error -- @sentry/node is optional; only resolved at runtime
      import("@sentry/node")
        .then((Sentry) => {
          Sentry.captureException(err, {
            extra: context,
          });
        })
        .catch(() => {
          log.warn("SENTRY_DSN set but @sentry/node not installed");
        });
    } catch {
      // Sentry not available — already logged above
    }
  }
}
