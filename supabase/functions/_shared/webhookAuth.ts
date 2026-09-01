export function constantTimeEqual(left: string, right: string) {
  const maxLength = Math.max(left.length, right.length);
  let mismatch = left.length ^ right.length;

  for (let index = 0; index < maxLength; index += 1) {
    mismatch |= (left.charCodeAt(index) || 0) ^ (right.charCodeAt(index) || 0);
  }

  return mismatch === 0;
}

export function matchesWebhookSecret(
  providedSecret: string | null,
  expectedSecrets: Array<string | null | undefined>,
) {
  if (!providedSecret) return false;

  return expectedSecrets.some((expectedSecret) =>
    !!expectedSecret && constantTimeEqual(expectedSecret, providedSecret)
  );
}
