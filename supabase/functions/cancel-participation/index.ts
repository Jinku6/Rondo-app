import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import Stripe from 'https://esm.sh/stripe@14.21.0?target=deno';
import { handleOptions, jsonError, jsonResponse, requirePost } from '../_shared/http.ts';
import { createServiceClient, createUserClient, requireUser } from '../_shared/supabase.ts';

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY') ?? '', { apiVersion: '2024-06-20' });

type CancelWindow = '48h_plus' | '24_48h' | '4_24h' | 'sub_4h';

function getWindow(matchDateISO: string): CancelWindow {
  const hoursUntil = (new Date(matchDateISO).getTime() - Date.now()) / 3_600_000;
  if (hoursUntil > 48) return '48h_plus';
  if (hoursUntil > 24) return '24_48h';
  if (hoursUntil > 4) return '4_24h';
  return 'sub_4h';
}

function calcRefundCents(window: CancelWindow, amountOrganizer: number, amountTotal: number): number {
  switch (window) {
    case '48h_plus':
      return amountTotal;
    case '24_48h':
      return Math.round(amountOrganizer * 0.75);
    case '4_24h':
      return Math.round(amountOrganizer * 0.25);
    case 'sub_4h':
      return 0;
  }
}

Deno.serve(async (req: Request) => {
  const options = handleOptions(req);
  if (options) return options;

  const methodError = requirePost(req);
  if (methodError) return methodError;

  const { user, error: authError } = await requireUser(req);
  if (!user) return jsonError(authError ?? 'Unauthorized', 401);

  let payload: { match_participant_id?: string };
  try {
    payload = await req.json();
  } catch {
    return jsonError('Invalid JSON body', 400);
  }

  if (!payload.match_participant_id) return jsonError('Missing match_participant_id', 400);

  const userClient = createUserClient(req);
  const { data: participant, error: participantError } = await userClient
    .from('match_participants')
    .select('id, user_id, match_id, status')
    .eq('id', payload.match_participant_id)
    .single();

  if (participantError || !participant) return jsonError('Participant not found', 404);
  if (participant.user_id !== user.id) return jsonError('Forbidden', 403);

  const { data: match, error: matchError } = await userClient
    .from('matches')
    .select('id, date_time, price_per_player')
    .eq('id', participant.match_id)
    .single();

  if (matchError || !match) return jsonError('Match not found', 404);

  const serviceClient = createServiceClient();
  const window = getWindow(match.date_time);
  const isPaid = Number(match.price_per_player ?? 0) > 0;
  let refundCents = 0;

  if (isPaid) {
    const { data: payment } = await serviceClient
      .from('payments')
      .select('id, stripe_intent_id, stripe_charge_id, status, amount_total, amount_organizer')
      .eq('match_participant_id', payload.match_participant_id)
      .maybeSingle();

    if (payment?.status === 'requires_payment_method' || payment?.status === 'authorized') {
      try {
        const intent = await stripe.paymentIntents.retrieve(payment.stripe_intent_id);
        if (!['canceled', 'succeeded'].includes(intent.status)) {
          await stripe.paymentIntents.cancel(payment.stripe_intent_id);
        }
      } catch (error) {
        console.warn('[cancel-participation] intent cancel failed', error);
      }

      await serviceClient.from('payments').update({ status: 'cancelled' }).eq('id', payment.id);
    }

    if (payment?.status === 'captured') {
      refundCents = calcRefundCents(window, payment.amount_organizer, payment.amount_total);

      if (refundCents > 0) {
        try {
          await stripe.refunds.create({
            payment_intent: payment.stripe_intent_id,
            amount: refundCents,
            reverse_transfer: true,
            refund_application_fee: window === '48h_plus',
          });
        } catch (error) {
          console.error('[cancel-participation] refund failed', error);
        }
      }

      await serviceClient
        .from('payments')
        .update({
          status: refundCents >= payment.amount_total ? 'refunded_full' : 'refunded_partial',
          refund_amount: refundCents,
          cancellation_window: window,
          refunded_at: refundCents > 0 ? new Date().toISOString() : null,
        })
        .eq('id', payment.id);
    }
  }

  if (window === '48h_plus') {
    await serviceClient
      .from('match_participants')
      .delete()
      .eq('id', payload.match_participant_id)
      .eq('user_id', user.id);
  } else {
    await serviceClient
      .from('match_participants')
      .update({ status: 'dropped', attended: window === '24_48h' })
      .eq('id', payload.match_participant_id)
      .eq('user_id', user.id);
  }

  return jsonResponse({
    success: true,
    window,
    refund_eur: refundCents / 100,
    reliability_impact: window === '4_24h' || window === 'sub_4h',
  });
});

