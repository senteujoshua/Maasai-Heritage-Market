import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/server';
import { apiError } from '@/lib/api-response';

const PAYPAL_BASE = process.env.PAYPAL_ENV === 'live'
  ? 'https://api-m.paypal.com'
  : 'https://api-m.sandbox.paypal.com';

async function getAccessToken(): Promise<string> {
  const credentials = Buffer.from(
    `${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_CLIENT_SECRET}`
  ).toString('base64');

  const res = await fetch(`${PAYPAL_BASE}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
  });

  const data = await res.json();
  if (!data.access_token) throw new Error('Failed to get PayPal access token');
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const { paypalOrderId, internalOrderId } = await req.json();

    if (!paypalOrderId || !internalOrderId) {
      return apiError('Missing paypalOrderId or internalOrderId', 400);
    }

    // Verify order belongs to authenticated user
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_id, payment_status')
      .eq('id', internalOrderId)
      .eq('buyer_id', user.id)
      .single();

    if (!order) return apiError('Order not found or access denied', 403);

    // Idempotency: skip if already completed
    if (order.payment_status === 'completed') {
      return NextResponse.json({ success: true });
    }

    const token = await getAccessToken();

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders/${paypalOrderId}/capture`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
    });

    const data = await res.json();

    if (data.status === 'COMPLETED') {
      const adminSupabase = await createAdminClient();
      await adminSupabase.from('orders').update({
        payment_status: 'completed',
        status: 'confirmed',
        paid_at: new Date().toISOString(),
      }).eq('id', internalOrderId);

      return NextResponse.json({ success: true });
    }

    return apiError('Payment not completed', 400);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PayPal capture error';
    return apiError(message, 500);
  }
}
