import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { createServiceClient } from '../_shared/supabase.ts';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 5;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

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

async function verifyCaptcha(token: string | undefined) {
  const secret = Deno.env.get('HCAPTCHA_SECRET');
  if (!secret || !token) return false;

  const body = new URLSearchParams({ secret, response: token });
  const response = await fetch('https://api.hcaptcha.com/siteverify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body,
  });

  if (!response.ok) return false;
  const result = await response.json();
  return result.success === true;
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;

  if (isRateLimited(getClientKey(req))) {
    return jsonError('Too many requests', 429);
  }

  let payload: { email?: string; captchaToken?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  const email = payload.email?.trim().toLowerCase();
  if (!email || !emailPattern.test(email)) return jsonError('Email no valido', 400);

  const captchaOk = await verifyCaptcha(payload.captchaToken);
  if (!captchaOk) return jsonError('Captcha verification failed', 403);

  const supabase = createServiceClient();
  const { error: dbError } = await supabase
    .from('waitlist')
    .insert({ email, source: 'website' });

  if (dbError && dbError.code !== '23505') {
    console.error('[waitlist] DB error', dbError.message);
    return jsonError('Error al registrar. Intentelo de nuevo.', 500);
  }

  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  if (brevoApiKey) {
    const brevoListId = Number(Deno.env.get('BREVO_WAITLIST_LIST_ID') || '2');
    const brevoResponse = await fetch('https://api.brevo.com/v3/contacts', {
      method: 'POST',
      headers: {
        'api-key': brevoApiKey,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({
        email,
        listIds: [brevoListId],
        attributes: { SOURCE: 'website_waitlist' },
        updateEnabled: true,
      }),
    });

    if (!brevoResponse.ok && brevoResponse.status !== 204) {
      console.error('[waitlist] Brevo error', await brevoResponse.text());
    }
  }

  return jsonResponse({
    success: true,
    message: dbError?.code === '23505'
      ? 'Ya estas en la lista. Te avisaremos.'
      : 'Apuntado. Te avisaremos cuando Rondo este disponible.',
  });
});
