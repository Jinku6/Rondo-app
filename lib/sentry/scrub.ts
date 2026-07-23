const SENTRY_REDACTED = '[Filtered]';
const SENTRY_SENSITIVE_KEY = /authorization|token|secret|password|api[_-]?key|apikey|email|phone|birthday|location|latitude|longitude|lat|lng|ip_address/i;
const SENTRY_SENSITIVE_TEXT = /([\w.%+-]+@[\w.-]+\.[A-Za-z]{2,})|(\+?\d[\d\s().-]{7,}\d)|(eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)/g;
const MAX_SENTRY_SCRUB_DEPTH = 6;

export const scrubSentryValue = (
  value: unknown,
  seen = new WeakSet<object>(),
  depth = 0,
): unknown => {
  if (typeof value === 'string') return value.replace(SENTRY_SENSITIVE_TEXT, SENTRY_REDACTED);
  if (!value || typeof value !== 'object') return value;
  if (depth >= MAX_SENTRY_SCRUB_DEPTH) return '[Truncated]';
  if (seen.has(value)) return '[Circular]';
  seen.add(value);

  if (Array.isArray(value)) {
    return value.map((entry) => scrubSentryValue(entry, seen, depth + 1));
  }

  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>).map(([key, entry]) => [
      key,
      SENTRY_SENSITIVE_KEY.test(key)
        ? SENTRY_REDACTED
        : scrubSentryValue(entry, seen, depth + 1),
    ]),
  );
};

export const scrubSentryEvent = (event: any) => {
  try {
    if (event.user) {
      event.user = event.user.id ? { id: event.user.id } : undefined;
    }
    event.extra = scrubSentryValue(event.extra) as any;
    event.contexts = scrubSentryValue(event.contexts) as any;
    event.request = scrubSentryValue(event.request) as any;
    event.breadcrumbs = Array.isArray(event.breadcrumbs)
      ? event.breadcrumbs.map((breadcrumb: unknown) => scrubSentryValue(breadcrumb))
      : event.breadcrumbs;
    return event;
  } catch {
    return null;
  }
};
