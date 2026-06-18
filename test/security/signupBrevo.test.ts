import { describe, expect, it, vi } from 'vitest';
import { createSignupBrevoHandler } from '../../supabase/functions/signup-brevo/handler';

const userId = '11111111-1111-4111-8111-111111111111';

function createRequest(email: string) {
  return new Request('https://example.com/signup-brevo', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-real-ip': crypto.randomUUID(),
    },
    body: JSON.stringify({ userId, email }),
  });
}

function createHandler(
  user: { email: string; user_metadata?: Record<string, unknown> },
  profileFullName?: string,
) {
  const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
  const getUserById = vi.fn().mockResolvedValue({
    data: { user },
    error: null,
  });
  const maybeSingle = vi.fn().mockResolvedValue({
    data: profileFullName ? { full_name: profileFullName } : null,
    error: null,
  });

  const handler = createSignupBrevoHandler({
    createServiceClient: () => ({
      auth: {
        admin: { getUserById },
      },
      from: () => ({
        select: () => ({
          eq: () => ({ maybeSingle }),
        }),
      }),
    }),
    fetch: fetchMock,
    getEnv: (name) => {
      if (name === 'BREVO_API_KEY') return 'test-brevo-key';
      if (name === 'BREVO_SIGNUP_LIST_ID') return '7';
      return undefined;
    },
  });

  return { fetchMock, getUserById, handler };
}

describe('signup-brevo edge function', () => {
  it.each([
    {
      provider: 'email',
      email: 'Email.User@Example.com',
      metadata: { full_name: 'Email User', birthday: '1998-04-12' },
      expectedAttributes: {
        FNAME: 'Email',
        LNAME: 'User',
        SOURCE: 'app_signup',
        BIRTHDAY: '1998-04-12',
      },
    },
    {
      provider: 'google',
      email: 'google.user@example.com',
      metadata: { name: 'Google User' },
      expectedAttributes: {
        FNAME: 'Google',
        LNAME: 'User',
        SOURCE: 'app_signup',
      },
    },
    {
      provider: 'apple',
      email: 'apple.user@example.com',
      metadata: {},
      profileFullName: 'Apple User',
      expectedAttributes: {
        FNAME: 'Apple',
        LNAME: 'User',
        SOURCE: 'app_signup',
      },
    },
  ])('syncs a new $provider signup with Brevo', async ({ email, metadata, profileFullName, expectedAttributes }) => {
    const { fetchMock, getUserById, handler } = createHandler({
      email: email.toLowerCase(),
      user_metadata: metadata,
    }, profileFullName);

    const response = await handler(createRequest(email));
    const brevoRequest = fetchMock.mock.calls[0];
    const body = JSON.parse(String(brevoRequest[1]?.body));

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ success: true });
    expect(getUserById).toHaveBeenCalledWith(userId);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(brevoRequest[0]).toBe('https://api.brevo.com/v3/contacts');
    expect(brevoRequest[1]?.method).toBe('POST');
    expect(brevoRequest[1]?.headers).toMatchObject({
      'api-key': 'test-brevo-key',
      'Content-Type': 'application/json',
      Accept: 'application/json',
    });
    expect(body).toEqual({
      email: email.toLowerCase(),
      attributes: expectedAttributes,
      listIds: [7],
      emailBlacklisted: false,
      smsBlacklisted: false,
      updateEnabled: true,
    });
  });

  it('does not sync to Brevo when the payload email does not match the auth user', async () => {
    const { fetchMock, handler } = createHandler({
      email: 'registered@example.com',
      user_metadata: {},
    });

    const response = await handler(createRequest('different@example.com'));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: 'Email no coincide con el usuario' });
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
