import { describe, expect, it } from 'vitest';
import { parseOAuthCallbackUrl } from '@/lib/auth/oauthCallback';

describe('parseOAuthCallbackUrl', () => {
  it('accepts PKCE code callbacks from query params', () => {
    expect(parseOAuthCallbackUrl('rondo:///?code=auth-code')).toEqual({
      type: 'code',
      code: 'auth-code',
    });
  });

  it('accepts implicit token callbacks from hash params', () => {
    expect(parseOAuthCallbackUrl('rondo:///#access_token=access&refresh_token=refresh')).toEqual({
      type: 'tokens',
      accessToken: 'access',
      refreshToken: 'refresh',
    });
  });

  it('returns provider errors from either query or hash params', () => {
    expect(parseOAuthCallbackUrl('rondo:///#error=access_denied&error_description=Denied')).toEqual({
      type: 'error',
      message: 'Denied',
    });
  });
});
