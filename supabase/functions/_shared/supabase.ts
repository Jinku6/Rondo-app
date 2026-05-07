import { createClient } from 'jsr:@supabase/supabase-js@2';

export const getBearerToken = (req: Request) => {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return null;
  return authHeader.slice('Bearer '.length).trim();
};

export const createUserClient = (req: Request) =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    {
      global: {
        headers: { Authorization: req.headers.get('Authorization') ?? '' },
      },
    }
  );

export const createServiceClient = () =>
  createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  );

export async function requireUser(req: Request) {
  const token = getBearerToken(req);
  if (!token) return { user: null, error: 'Missing Authorization header' };

  const supabase = createUserClient(req);
  const { data, error } = await supabase.auth.getUser(token);
  if (error || !data.user) return { user: null, error: 'Invalid token' };

  return { user: data.user, error: null };
}

