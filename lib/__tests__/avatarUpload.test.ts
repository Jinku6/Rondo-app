import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  getSession: vi.fn(),
  upload: vi.fn(),
  getPublicUrl: vi.fn(),
}));

vi.mock('expo-image-picker', () => ({}));
vi.mock('base64-arraybuffer', () => ({ decode: vi.fn(() => new ArrayBuffer(0)) }));
vi.mock('@/lib/supabase', () => ({
  supabase: {
    auth: { getUser: mocks.getUser, getSession: mocks.getSession },
    storage: { from: vi.fn(() => ({ upload: mocks.upload, getPublicUrl: mocks.getPublicUrl })) },
  },
}));

import { uploadAvatar } from '../avatarUpload';

const userId = '11111111-1111-4111-8111-111111111111';
const asset = {
  base64: 'aW1hZ2U=',
  mimeType: 'image/png',
  fileSize: 1024,
} as Parameters<typeof uploadAvatar>[0]['asset'];

describe('uploadAvatar', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('uses the validated session identity and forwards its bearer token to Storage', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.getSession.mockResolvedValue({
      data: { session: { user: { id: userId }, access_token: 'current-token' } },
      error: null,
    });
    mocks.upload.mockResolvedValue({ error: null });
    mocks.getPublicUrl.mockReturnValue({ data: { publicUrl: 'https://example.test/avatar.png' } });

    await expect(uploadAvatar({ asset, folder: 'teams/team-id' })).resolves.toBe('https://example.test/avatar.png');

    expect(mocks.upload).toHaveBeenCalledWith(
      expect.stringMatching(new RegExp(`^${userId}/teams/team-id/\\d+\\.png$`)),
      expect.any(ArrayBuffer),
      expect.objectContaining({ headers: { Authorization: 'Bearer current-token' } }),
    );
  });

  it('does not upload when the local session is missing or belongs to another user', async () => {
    mocks.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
    mocks.getSession.mockResolvedValue({ data: { session: null }, error: null });

    await expect(uploadAvatar({ asset })).rejects.toThrow('Tu sesión ya no es válida');
    expect(mocks.upload).not.toHaveBeenCalled();
  });
});
