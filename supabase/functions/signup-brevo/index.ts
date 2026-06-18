import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createServiceClient } from '../_shared/supabase.ts';
import { createSignupBrevoHandler } from './handler.ts';

Deno.serve(createSignupBrevoHandler({
  createServiceClient,
  fetch,
  getEnv: (name) => Deno.env.get(name),
}));
