import { NextRequest, NextResponse } from 'next/server';
import { initiateSTKPush } from '@/lib/mpesa/daraja';
import { createAdminClient } from '@/lib/supabase/server';

export async function POST(req: NextRequest) {
  try {
    const { phone, amount, orderId, description } = await req.json();

    if (!phone || !amount || !orderId) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    if (!/^254[17]\d{8}$/.test(phone)) {
      return NextResponse.json({ error: 'Invalid phone number format. Expected 254XXXXXXXXX' }, { status: 400 });
    }

    const result = await initiateSTKPush({
      phone,
      amount: Math.ceil(amount),
      orderId,
      description: description || `Order ${orderId}`,
    });

    if (result.ResponseCode !== '0') {
      return NextResponse.json({ error: result.ResponseDescription || 'STK push failed' }, { status: 400 });
    }

    // Store checkout request ID for callback matching
    const supabase = await createAdminClient();
    await supabase.from('orders').update({
      mpesa_checkout_request_id: result.CheckoutRequestID,
      payment_status: 'awaiting_payment',
    }).eq('id', orderId);

    return NextResponse.json({
      success: true,
      checkoutRequestId: result.CheckoutRequestID,
      merchantRequestId: result.MerchantRequestID,
      message: 'STK Push sent successfully. Check your phone.',
    });
  } catch (error: unknown) {
    console.error('M-Pesa STK Push error:', error);
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
