import { describe, expect, it } from 'vitest';
import {
  constantTimeEqual,
  matchesWebhookSecret,
} from '../../supabase/functions/_shared/webhookAuth';

describe('push webhook authentication', () => {
  it('compares equal secrets without short-circuiting by content', () => {
    expect(constantTimeEqual('primary-secret', 'primary-secret')).toBe(true);
    expect(constantTimeEqual('primary-secret', 'primary-secrex')).toBe(false);
    expect(constantTimeEqual('short', 'longer')).toBe(false);
  });

  it('accepts the primary secret', () => {
    expect(matchesWebhookSecret('primary-secret', ['primary-secret', undefined])).toBe(true);
  });

  it('accepts the temporary next secret during rotation', () => {
    expect(matchesWebhookSecret('next-secret', ['primary-secret', 'next-secret'])).toBe(true);
  });

  it('rejects missing, empty, and incorrect secrets', () => {
    expect(matchesWebhookSecret(null, ['primary-secret'])).toBe(false);
    expect(matchesWebhookSecret('', ['primary-secret'])).toBe(false);
    expect(matchesWebhookSecret('incorrect', ['primary-secret', 'next-secret'])).toBe(false);
    expect(matchesWebhookSecret('anything', [undefined, null, ''])).toBe(false);
  });
});
