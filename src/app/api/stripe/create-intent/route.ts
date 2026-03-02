import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const { amount, orderId } = await req.json();

    if (!amount || !orderId) {
      return apiError('Missing amount or orderId', 400);
    }

    // Verify this order belongs to the authenticated user
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_id')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (!order) return apiError('Order not found or access denied', 403);

    // KES is a zero-decimal currency in Stripe — pass amount directly (no ×100)
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount),
      currency: 'kes',
      metadata: { orderId, userId: user.id },
    });

    return NextResponse.json({ clientSecret: paymentIntent.client_secret });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Stripe error';
    return apiError(message, 500);
  }
}
