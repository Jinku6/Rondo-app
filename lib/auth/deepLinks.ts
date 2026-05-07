type TrustedAuthCallback = {
  code: string;
  isRecoveryLink: boolean;
};

const TRUSTED_SCHEME = 'rondo:';
const RECOVERY_ROUTE = 'reset-password';
const NON_RECOVERY_ROUTES = new Set(['login']);
const AUTH_TYPES = new Set(['recovery', 'signup', 'email_change']);

const routeFromUrl = (parsed: URL) => {
  const host = parsed.hostname;
  const path = parsed.pathname.replace(/^\/+/, '').replace(/\/+$/, '');
  return [host, path].filter(Boolean).join('/');
};

const paramsFromUrl = (parsed: URL) => {
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const hashParams = new URLSearchParams(hash);
  const params = new URLSearchParams(parsed.search);

  return {
    type: params.get('type') ?? hashParams.get('type'),
    code: params.get('code') ?? hashParams.get('code'),
    hasRawSessionTokens: Boolean(
      (params.get('access_token') ?? hashParams.get('access_token'))
      || (params.get('refresh_token') ?? hashParams.get('refresh_token'))
    ),
  };
};

export function parseTrustedAuthCallback(url: string, allowedWebOrigin?: string): TrustedAuthCallback | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }

  const isTrustedNative = parsed.protocol === TRUSTED_SCHEME;
  const isTrustedWeb = Boolean(
    allowedWebOrigin
    && (parsed.protocol === 'https:' || parsed.protocol === 'http:')
    && parsed.origin === allowedWebOrigin
  );

  if (!isTrustedNative && !isTrustedWeb) return null;

  const { type, code, hasRawSessionTokens } = paramsFromUrl(parsed);
  if (hasRawSessionTokens || !code || !type || !AUTH_TYPES.has(type)) return null;

  const route = routeFromUrl(parsed);
  const isRecoveryLink = type === 'recovery';

  if (isRecoveryLink) {
    return route === RECOVERY_ROUTE ? { code, isRecoveryLink: true } : null;
  }

  return NON_RECOVERY_ROUTES.has(route) ? { code, isRecoveryLink: false } : null;
}

