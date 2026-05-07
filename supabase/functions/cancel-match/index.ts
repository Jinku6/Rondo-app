import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { createServiceClient, createUserClient, requireUser } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;

  const { user, error: authError } = await requireUser(req);
  if (!user) return jsonError(authError ?? 'Unauthorized', 401);

  let payload: { match_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!payload.match_id) return jsonError('Missing match_id', 400);

  const userClient = createUserClient(req);
  const { data: match, error: matchError } = await userClient
    .from('matches')
    .select('id, organizer_id, status, price_per_player')
    .eq('id', payload.match_id)
    .single();

  if (matchError || !match) return jsonError('Match not found', 404);
  if (match.organizer_id !== user.id) return jsonError('Forbidden', 403);
  if (match.status !== 'open') return jsonError('Match is not open', 400);

  const serviceClient = createServiceClient();

  const { error: updateError } = await serviceClient
    .from('matches')
    .update({ status: 'cancelled' })
    .eq('id', payload.match_id)
    .eq('organizer_id', user.id)
    .eq('status', 'open');

  if (updateError) return jsonError('Could not cancel match', 500);

  const { data: payments } = await serviceClient
    .from('payments')
    .select('id, stripe_intent_id, stripe_charge_id, status')
    .eq('match_id', payload.match_id);

  for (const payment of payments ?? []) {
    if (payment.status === 'authorized') {
      try {
        await stripe.paymentIntents.cancel(payment.stripe_intent_id);
      } catch (error) {
        console.warn('[cancel-match] payment intent cancel failed', error);
      }

      await serviceClient
        .from('payments')
        .update({ status: 'cancelled', match_participant_id: null })
        .eq('id', payment.id);
    }

    if (payment.status === 'captured' && payment.stripe_charge_id) {
      try {
        await stripe.refunds.create({
          charge: payment.stripe_charge_id,
          reverse_transfer: true,
          refund_application_fee: true,
        });
        await serviceClient
          .from('payments')
          .update({ status: 'refunded_full', match_participant_id: null })
          .eq('id', payment.id);
      } catch (error) {
        console.error('[cancel-match] refund failed', error);
      }
    }
  }

  await serviceClient
    .from('payouts')
    .update({ status: 'cancelled' })
    .eq('match_id', payload.match_id)
    .eq('status', 'pending');

  return jsonResponse({ success: true });
});

