import AsyncStorage from '@react-native-async-storage/async-storage';

const PENDING_SERIES_INVITE_KEY = 'rondo:pending-series-invite';
const INVITE_CODE_PATTERN = /^[0-9a-f]{32}$/;

export function normalizeSeriesInviteCode(value: string | undefined): string | null {
  const code = value?.trim().toLowerCase();
  return code && INVITE_CODE_PATTERN.test(code) ? code : null;
}

export function buildSeriesInviteUrl(code: string): string {
  return `https://rondofc.app/join/${code}`;
}

export async function getPostAuthSeriesInvitePath(): Promise<`/join/${string}` | null> {
  const code = await getPendingSeriesInvite();
  return code ? `/join/${code}` : null;
}

export async function completeSeriesInvite(
  code: string,
  join: (inviteCode: string) => Promise<string>,
): Promise<string> {
  const normalized = normalizeSeriesInviteCode(code);
  if (!normalized) throw new Error('El código de invitación no es válido.');

  const teamId = await join(normalized);
  await clearPendingSeriesInvite();
  return teamId;
}

export async function savePendingSeriesInvite(code: string): Promise<boolean> {
  try {
    const normalized = normalizeSeriesInviteCode(code);
    if (!normalized) return false;
    await AsyncStorage.setItem(PENDING_SERIES_INVITE_KEY, normalized);
    return true;
  } catch {
    return false;
  }
}

export async function getPendingSeriesInvite(): Promise<string | null> {
  try {
    const code = await AsyncStorage.getItem(PENDING_SERIES_INVITE_KEY);
    return normalizeSeriesInviteCode(code ?? undefined);
  } catch {
    return null;
  }
}

export async function clearPendingSeriesInvite(): Promise<void> {
  try {
    await AsyncStorage.removeItem(PENDING_SERIES_INVITE_KEY);
  } catch {
    // Membership is already persisted; stale local state is harmless.
  }
}
