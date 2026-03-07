import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import Stripe from 'stripe';
import { createAdminClient } from '@/lib/supabase/server';
import { auditLog } from '@/lib/audit';
import { sendEmail, orderConfirmedHtml } from '@/lib/email';

export async function POST(req: NextRequest) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
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

  // Idempotency: skip already-processed events
  const { data: existing } = await supabase
    .from('processed_webhook_events')
    .select('id')
    .eq('id', event.id)
    .single();

  if (existing) return NextResponse.json({ received: true });

  try {
    if (event.type === 'payment_intent.succeeded') {
      const intent = event.data.object as Stripe.PaymentIntent;
      const orderId = intent.metadata.orderId;

      if (orderId) {
        const { data: order } = await supabase
          .from('orders')
          .update({ payment_status: 'paid', status: 'confirmed', paid_at: new Date().toISOString() })
          .eq('id', orderId)
          .select('id, total, items, buyer:profiles!buyer_id(full_name, email)')
          .single();

        auditLog({ actorId: intent.metadata.userId ?? orderId, action: 'payment_completed',
          entityType: 'order', entityId: orderId, payload: { method: 'stripe', intent_id: intent.id } });

        if (order) {
          const buyer = order.buyer as unknown as Record<string, unknown>;
          if (buyer?.email) {
            sendEmail({
              to: buyer.email as string,
              subject: `Order confirmed — #${order.id.slice(0, 8).toUpperCase()}`,
              html: orderConfirmedHtml({
                buyerName: (buyer.full_name as string) ?? 'Valued Customer',
                orderId:   order.id,
                total:     order.total,
                method:    'stripe',
                items:     (order.items as Array<{ title: string; quantity: number; unit_price: number }>) ?? [],
              }),
            }).catch(console.error);
          }
        }
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
  } catch (err) {
    Sentry.captureException(err);
  }

  await supabase.from('processed_webhook_events').insert({ id: event.id });
  return NextResponse.json({ received: true });
}
