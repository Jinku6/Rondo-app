import { describe, expect, it, vi } from 'vitest';

const storage = new Map<string, string>();

vi.mock('@react-native-async-storage/async-storage', () => ({
  default: {
    getItem: vi.fn(async (key: string) => storage.get(key) ?? null),
    removeItem: vi.fn(async (key: string) => { storage.delete(key); }),
    setItem: vi.fn(async (key: string, value: string) => { storage.set(key, value); }),
  },
}));

import {
  buildSeriesInviteUrl,
  clearPendingSeriesInvite,
  completeSeriesInvite,
  getPostAuthSeriesInvitePath,
  normalizeSeriesInviteCode,
  savePendingSeriesInvite,
} from '../seriesInvite';

const code = '0123456789abcdef0123456789abcdef';

describe('series invites', () => {
  it('normalizes valid codes and generates the shared URL', () => {
    expect(normalizeSeriesInviteCode(` ${code.toUpperCase()} `)).toBe(code);
    expect(normalizeSeriesInviteCode('not-an-invite')).toBeNull();
    expect(buildSeriesInviteUrl(code)).toBe(`https://rondofc.app/join/${code}`);
  });

  it('prioritizes a pending invite after authentication and clears only on request', async () => {
    await clearPendingSeriesInvite();
    expect(await getPostAuthSeriesInvitePath()).toBeNull();
    expect(await savePendingSeriesInvite(code)).toBe(true);
    expect(await getPostAuthSeriesInvitePath()).toBe(`/join/${code}`);
    await clearPendingSeriesInvite();
    expect(await getPostAuthSeriesInvitePath()).toBeNull();
  });

  it('clears the invite only after a successful join', async () => {
    await savePendingSeriesInvite(code);
    await expect(completeSeriesInvite(code, async () => {
      throw new Error('network failed');
    })).rejects.toThrow('network failed');
    expect(await getPostAuthSeriesInvitePath()).toBe(`/join/${code}`);

    await expect(completeSeriesInvite(code, async (inviteCode) => {
      expect(inviteCode).toBe(code);
      return 'team-id';
    })).resolves.toBe('team-id');
    expect(await getPostAuthSeriesInvitePath()).toBeNull();
  });
});
