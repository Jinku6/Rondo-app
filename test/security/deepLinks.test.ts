import { describe, expect, it } from 'vitest';
import { parseTrustedAuthCallback } from '@/lib/auth/deepLinks';

describe('parseTrustedAuthCallback', () => {
  it('rejects non-Rondo schemes and legacy tempapp callbacks', () => {
    expect(parseTrustedAuthCallback('tempapp://reset-password#access_token=a&refresh_token=b')).toBeNull();
    expect(parseTrustedAuthCallback('https://evil.example/reset-password#access_token=a&refresh_token=b')).toBeNull();
  });

  it('rejects raw access and refresh token links', () => {
    expect(parseTrustedAuthCallback('rondo://reset-password#access_token=a&refresh_token=b&type=recovery')).toBeNull();
  });

  it('accepts expected Rondo recovery code callbacks only', () => {
    expect(parseTrustedAuthCallback('rondo://reset-password?type=recovery&code=abc123')).toEqual({
      code: 'abc123',
      isRecoveryLink: true,
    });
  });

  it('accepts expected Rondo signup and email-change code callbacks', () => {
    expect(parseTrustedAuthCallback('rondo://login?type=signup&code=signup-code')).toEqual({
      code: 'signup-code',
      isRecoveryLink: false,
    });
    expect(parseTrustedAuthCallback('rondo://login?type=email_change&code=email-code')).toEqual({
      code: 'email-code',
      isRecoveryLink: false,
    });
  });
});

