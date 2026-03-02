import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
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

    const token = await getAccessToken();

    // Convert KES to USD (approximate rate: 1 USD ≈ 130 KES)
    const usdAmount = (amount / 130).toFixed(2);

    const res = await fetch(`${PAYPAL_BASE}/v2/checkout/orders`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [{
          reference_id: orderId,
          amount: { currency_code: 'USD', value: usdAmount },
          description: `Maasai Heritage Market Order ${orderId}`,
        }],
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      return apiError(data.message || 'PayPal order creation failed', 500);
    }

    return NextResponse.json({ id: data.id });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'PayPal error';
    return apiError(message, 500);
  }
}
