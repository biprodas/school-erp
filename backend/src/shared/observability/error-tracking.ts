import * as Sentry from '@sentry/node';

let enabled = false;

/**
 * Error tracking (PRD 8.8): Sentry when `SENTRY_DSN` is set, nothing
 * otherwise (local and tests). Call first thing in `main.ts`.
 */
export function initErrorTracking(): boolean {
  const dsn = process.env.SENTRY_DSN?.trim();
  if (!dsn) return false;
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? process.env.NODE_ENV,
    release: process.env.APP_RELEASE,
    tracesSampleRate: Number(process.env.SENTRY_TRACES_SAMPLE_RATE ?? 0),
    // Request bodies and headers may carry personal data and tokens.
    sendDefaultPii: false,
  });
  enabled = true;
  return true;
}

/** What helps find an error: never personal data or secrets. */
export interface ErrorContext {
  orgId?: string | null;
  requestId?: string | null;
  /** e.g. `GET /api/students`, `job pdf:report-cards`. */
  where?: string;
}

/** Sends an unexpected error to the tracker (a no-op when it is off). */
export function reportError(err: unknown, context: ErrorContext = {}): void {
  if (!enabled) return;
  Sentry.withScope((scope) => {
    if (context.orgId) scope.setTag('org_id', context.orgId);
    if (context.requestId) scope.setTag('request_id', context.requestId);
    if (context.where) scope.setTag('where', context.where);
    Sentry.captureException(err);
  });
}

/** Sends what is still buffered (on shutdown). */
export async function flushErrorTracking(timeoutMs = 2000): Promise<void> {
  if (enabled) await Sentry.flush(timeoutMs);
}
