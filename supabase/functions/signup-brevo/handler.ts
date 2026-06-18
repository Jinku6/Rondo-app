const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX_REQUESTS = 20;
const rateLimitBuckets = new Map<string, { count: number; resetAt: number }>();

type SignupBrevoPayload = {
  userId?: string;
  email?: string;
};

type AuthUser = {
  email?: string | null;
  user_metadata?: Record<string, unknown> | null;
};

type ServiceClient = {
  auth: {
    admin: {
      getUserById: (userId: string) => Promise<{
        data: { user: AuthUser | null };
        error: { message?: string } | null;
      }>;
    };
  };
  from?: (table: 'users') => {
    select: (columns: 'full_name') => {
      eq: (column: 'id', value: string) => {
        maybeSingle: () => Promise<{
          data: { full_name?: string | null } | null;
          error: { message?: string } | null;
        }>;
      };
    };
  };
};

type SignupBrevoDependencies = {
  createServiceClient: () => ServiceClient;
  fetch: typeof fetch;
  getEnv: (name: string) => string | undefined;
};

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

const jsonError = (message: string, status: number) =>
  jsonResponse({ error: message }, status);

const handleOptions = (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  return null;
};

const requirePost = (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);
  return null;
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

function getMetadataFullName(metadata: Record<string, unknown>) {
  return typeof metadata.full_name === 'string'
    ? metadata.full_name
    : typeof metadata.name === 'string'
      ? metadata.name
      : undefined;
}

async function getProfileFullName(supabase: ServiceClient, userId: string) {
  if (!supabase.from) return undefined;

  try {
    const { data, error } = await supabase
      .from('users')
      .select('full_name')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      console.warn('[signup-brevo] Profile lookup error', error.message);
      return undefined;
    }

    return data?.full_name?.trim() || undefined;
  } catch (error) {
    console.warn('[signup-brevo] Profile lookup failed', error);
    return undefined;
  }
}

function getListIds(getEnv: SignupBrevoDependencies['getEnv']) {
  const raw = getEnv('BREVO_SIGNUP_LIST_ID');
  if (!raw) return undefined;

  const listId = Number(raw);
  return Number.isInteger(listId) && listId > 0 ? [listId] : undefined;
}

export function createSignupBrevoHandler(deps: SignupBrevoDependencies) {
  return async (req: Request) => {
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

    const supabase = deps.createServiceClient();
    let authResult: Awaited<ReturnType<ServiceClient['auth']['admin']['getUserById']>>;
    try {
      authResult = await supabase.auth.admin.getUserById(userId);
    } catch (error) {
      console.error('[signup-brevo] Auth user lookup failed', error);
      return jsonError('Usuario no encontrado', 404);
    }

    const { data, error: authError } = authResult;
    if (authError || !data.user) {
      console.error('[signup-brevo] Auth user lookup error', authError?.message);
      return jsonError('Usuario no encontrado', 404);
    }

    const authEmail = data.user.email?.trim().toLowerCase();
    if (authEmail !== email) return jsonError('Email no coincide con el usuario', 403);

    const brevoApiKey = deps.getEnv('BREVO_API_KEY');
    if (!brevoApiKey) {
      console.error('[signup-brevo] Missing BREVO_API_KEY');
      return jsonError('Brevo no configurado', 500);
    }

    const metadata = data.user.user_metadata ?? {};
    const fullName = getMetadataFullName(metadata) ?? await getProfileFullName(supabase, userId);
    const attributes: Record<string, string> = { SOURCE: 'app_signup' };
    Object.assign(attributes, splitFullName(fullName));

    if (typeof metadata.birthday === 'string' && metadata.birthday.trim()) {
      attributes.BIRTHDAY = metadata.birthday.trim();
    }

    const brevoBody = {
      email,
      attributes,
      listIds: getListIds(deps.getEnv),
      emailBlacklisted: false,
      smsBlacklisted: false,
      updateEnabled: true,
    };

    let brevoResponse: Response;
    try {
      brevoResponse = await deps.fetch('https://api.brevo.com/v3/contacts', {
        method: 'POST',
        headers: {
          'api-key': brevoApiKey,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(brevoBody),
      });
    } catch (error) {
      console.error('[signup-brevo] Brevo request failed', error);
      return jsonError('No se pudo sincronizar con Brevo', 502);
    }

    if (!brevoResponse.ok && brevoResponse.status !== 204) {
      console.error('[signup-brevo] Brevo error', await brevoResponse.text());
      return jsonError('No se pudo sincronizar con Brevo', 502);
    }

    return jsonResponse({ success: true });
  };
}
