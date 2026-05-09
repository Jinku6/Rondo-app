export type OAuthCallbackParams =
  | { type: 'code'; code: string }
  | { type: 'tokens'; accessToken: string; refreshToken: string }
  | { type: 'error'; message: string }
  | { type: 'empty' };

const getCallbackParams = (url: string) => {
  const parsed = new URL(url);
  const hash = parsed.hash.startsWith('#') ? parsed.hash.slice(1) : parsed.hash;
  const searchParams = new URLSearchParams(parsed.search);
  const hashParams = new URLSearchParams(hash);

  return {
    code: searchParams.get('code') ?? hashParams.get('code'),
    accessToken: searchParams.get('access_token') ?? hashParams.get('access_token'),
    refreshToken: searchParams.get('refresh_token') ?? hashParams.get('refresh_token'),
    errorCode: searchParams.get('error_code') ?? hashParams.get('error_code'),
    errorDescription: searchParams.get('error_description') ?? hashParams.get('error_description'),
    error: searchParams.get('error') ?? hashParams.get('error'),
  };
};

export const parseOAuthCallbackUrl = (url: string): OAuthCallbackParams => {
  try {
    const params = getCallbackParams(url);

    if (params.errorCode || params.errorDescription || params.error) {
      return {
        type: 'error',
        message: params.errorDescription ?? params.errorCode ?? params.error ?? 'No se pudo completar la autenticacion.',
      };
    }

    if (params.code) {
      return { type: 'code', code: params.code };
    }

    if (params.accessToken && params.refreshToken) {
      return {
        type: 'tokens',
        accessToken: params.accessToken,
        refreshToken: params.refreshToken,
      };
    }

    return { type: 'empty' };
  } catch {
    return { type: 'empty' };
  }
};
