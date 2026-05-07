export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-cron-secret',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export const jsonHeaders = { ...corsHeaders, 'Content-Type': 'application/json' };

export const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: jsonHeaders });

export const jsonError = (message: string, status: number) =>
  jsonResponse({ error: message }, status);

export const handleOptions = (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });
  return null;
};

export const requirePost = (req: Request) => {
  if (req.method !== 'POST') return jsonError('Method not allowed', 405);
  return null;
};

