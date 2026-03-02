import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { initiateSTKPush } from '@/lib/mpesa/daraja';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { apiOk, apiError } from '@/lib/api-response';

export async function POST(req: NextRequest) {
  try {
    // Auth guard — only the order's buyer should trigger STK push
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const { phone, amount, orderId, description } = await req.json();

    if (!phone || !amount || !orderId) {
      return apiError('Missing required fields', 400);
    }

    if (!/^254[17]\d{8}$/.test(phone)) {
      return apiError('Invalid phone number format. Expected 254XXXXXXXXX', 400);
    }

    // Verify order belongs to user
    const { data: order } = await supabase
      .from('orders')
      .select('id, buyer_id')
      .eq('id', orderId)
      .eq('buyer_id', user.id)
      .single();

    if (!order) return apiError('Order not found or access denied', 403);

    const result = await initiateSTKPush({
      phone,
      amount: Math.ceil(amount),
      accountRef: orderId,
      description: description || `Order ${orderId}`,
    });

    if (result.ResponseCode !== '0') {
      return apiError(result.ResponseDescription || 'STK push failed', 400);
    }

    const adminSupabase = await createAdminClient();
    await adminSupabase.from('orders').update({
      mpesa_checkout_request_id: result.CheckoutRequestID,
      payment_status: 'awaiting_payment',
    }).eq('id', orderId);

    return apiOk({
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      message: 'STK Push sent successfully. Check your phone.',
    });
  } catch (error: unknown) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return apiError(message, 500);
  }
}
