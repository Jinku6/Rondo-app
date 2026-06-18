import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { requireUser } from '../_shared/supabase.ts';

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;

  const { user, error: userError } = await requireUser(req);
  if (userError || !user) return jsonError(userError ?? 'Invalid token', 401);

  const email = user.email?.trim().toLowerCase();
  if (!email) return jsonError('Email no disponible', 400);

  const brevoApiKey = Deno.env.get('BREVO_API_KEY');
  if (!brevoApiKey) {
    console.warn('[delete-brevo-contact] Missing BREVO_API_KEY');
    return jsonResponse({ success: true, skipped: 'missing_config' });
  }

  try {
    const brevoResponse = await fetch(`https://api.brevo.com/v3/contacts/${encodeURIComponent(email)}`, {
      method: 'DELETE',
      headers: {
        'api-key': brevoApiKey,
        Accept: 'application/json',
      },
    });

    if (brevoResponse.status === 404) {
      return jsonResponse({ success: true, skipped: 'not_found' });
    }

    if (!brevoResponse.ok && brevoResponse.status !== 204) {
      console.warn('[delete-brevo-contact] Brevo error', await brevoResponse.text());
      return jsonResponse({ success: true, skipped: 'brevo_error' });
    }
  } catch (error) {
    console.warn('[delete-brevo-contact] Brevo request failed', error);
    return jsonResponse({ success: true, skipped: 'brevo_request_failed' });
  }

  return jsonResponse({ success: true });
});
