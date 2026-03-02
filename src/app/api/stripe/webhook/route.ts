import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  const body = await req.text();
  const signature = req.headers.get('stripe-signature');

  if (!signature) {
    return NextResponse.json({ error: 'Missing stripe-signature header' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return NextResponse.json({ error: 'Invalid webhook signature' }, { status: 400 });
  }

  const supabase = await createAdminClient();

  // Idempotency: skip if this event was already processed
  const { data: existing } = await supabase
    .from('processed_webhook_events')
    .select('id')
    .eq('id', event.id)
    .single();

  if (existing) {
    return NextResponse.json({ received: true });
  }

  if (event.type === 'payment_intent.succeeded') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.orderId;

    if (orderId) {
      await supabase.from('orders').update({
        payment_status: 'completed',
        status: 'confirmed',
        paid_at: new Date().toISOString(),
      }).eq('id', orderId);
    }
  }

  if (event.type === 'payment_intent.payment_failed') {
    const intent = event.data.object as Stripe.PaymentIntent;
    const orderId = intent.metadata.orderId;

    if (orderId) {
      await supabase.from('orders').update({
        payment_status: 'failed',
        failure_reason: intent.last_payment_error?.message ?? 'Payment failed',
      }).eq('id', orderId);
    }
  }

  // Record that this event was processed
  await supabase.from('processed_webhook_events').insert({ id: event.id });

  return NextResponse.json({ received: true });
}
