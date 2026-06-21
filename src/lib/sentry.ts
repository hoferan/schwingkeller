import * as Sentry from '@sentry/react';

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn, tracesSampleRate: 0.1 });
};

export const extractCode = (err: unknown): string | null => {
  if (!(err instanceof Error)) return null;
  const m = err.message.match(/^\[(\w+)\]/);
  return m ? m[1] : null;
};

export const captureAndFormat = (err: unknown, fallback: string): string => {
  Sentry.captureException(err);
  const code = extractCode(err);
  return code ? `${fallback} [${code}]` : fallback;
};
