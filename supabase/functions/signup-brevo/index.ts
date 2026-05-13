import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type SignupBrevoPayload = {
  userId?: string;
  email?: string;
};

function getClientKey(req: Request) {
  return (
    req.headers.get('cf-connecting-ip')
    ?? req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  );
}

function isRateLimited(key: string) {
  const now = Date.now();
  const bucket = rateLimitBuckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    rateLimitBuckets.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  bucket.count += 1;
  return bucket.count > RATE_LIMIT_MAX_REQUESTS;
}

function splitFullName(fullName?: string) {
  const cleanName = fullName?.trim();
  if (!cleanName) return {};

  const [firstName, ...lastNameParts] = cleanName.split(/\s+/);
  return {
    FNAME: firstName,
    LNAME: lastNameParts.join(' '),
  };
}

function getListIds() {
  const raw = Deno.env.get('BREVO_SIGNUP_LIST_ID');
  const listId = raw ? Number(raw) : null;
  return Number.isInteger(listId) && listId > 0 ? [listId] : undefined;
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;

  if (isRateLimited(getClientKey(req))) {
    return jsonError('Too many requests', 429);
  }

  let payload: SignupBrevoPayload;
  try {
    payload = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const userId = payload.userId?.trim();
  const email = payload.email?.trim().toLowerCase();

  if (!userId || !uuidPattern.test(userId)) return jsonError('User id no valido', 400);
  if (!email || !emailPattern.test(email)) return jsonError('Email no valido', 400);

  const supabase = createServiceClient();
  const { data, error: authError } = await supabase.auth.admin.getUserById(userId);

  if (authError || !data.user) {
    console.error('[signup-brevo] Auth user lookup error', authError?.message);
    return jsonError('Usuario no encontrado', 404);
  }

  const authEmail = data.user.email?.trim().toLowerCase();
  if (authEmail !== email) return jsonError('Email no coincide con el usuario', 403);

  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  if (!brevoApiKey) {
    console.error('[signup-brevo] Missing BREVO_API_KEY');
    return jsonError('Brevo no configurado', 500);
  }

  const metadata = data.user.user_metadata ?? {};
  const fullName = typeof metadata.full_name === 'string'
    ? metadata.full_name
    : typeof metadata.name === 'string'
      ? metadata.name
      : undefined;
  const attributes: Record<string, string> = {
    ...splitFullName(fullName),
    SOURCE: 'app_signup',
  };

  if (typeof metadata.birthday === 'string' && metadata.birthday.trim()) {
    attributes.BIRTHDAY = metadata.birthday.trim();
  }

  const brevoBody = {
    email,
    attributes,
    listIds: getListIds(),
    emailBlacklisted: false,
    smsBlacklisted: false,
    updateEnabled: true,
  };

  const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
    method: 'POST',
    headers: {
      'api-key': brevoApiKey,
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
    body: JSON.stringify(brevoBody),
  });

  if (!brevoResponse.ok && brevoResponse.status !== 204) {
    console.error('[signup-brevo] Brevo error', await brevoResponse.text());
    return jsonError('No se pudo sincronizar con Brevo', 502);
  }

  return jsonResponse({ success: true });
});
