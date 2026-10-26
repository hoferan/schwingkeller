import * as Sentry from '@sentry/react';
import { withoutInviteParam } from './permalink';

export const initSentry = (): void => {
  const dsn = import.meta.env.VITE_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({
    dsn,
    environment: import.meta.env.VITE_APP_ENV || 'development',
    tracesSampleRate: 0.1,
    // An invitation token is a credential until it is used (#140). App removes it from the address
    // bar with history.replaceState, which leaves a navigation breadcrumb whose `from` still has it.
    beforeBreadcrumb: (breadcrumb) => {
      const data = breadcrumb.data;
      if (!data) return breadcrumb;
      const scrubbed = { ...data };
      for (const key of ['from', 'to', 'url']) {
        if (typeof scrubbed[key] === 'string') scrubbed[key] = withoutInviteParam(scrubbed[key]);
      }
      return { ...breadcrumb, data: scrubbed };
    },
    beforeSend: (event) =>
      event.request?.url ? { ...event, request: { ...event.request, url: withoutInviteParam(event.request.url) } } : event,
  });
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
