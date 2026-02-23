import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS, SMS_TEMPLATES } from '@/lib/africastalking/sms';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { Body } = body;

    if (!Body?.stkCallback) {
      return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
    const supabase = await createAdminClient();

    if (ResultCode === 0) {
      // Payment successful
      const meta: Record<string, string | number> = {};
      (CallbackMetadata?.Item || []).forEach((item: { Name: string; Value: string | number }) => {
        meta[item.Name] = item.Value;
      });

      const { data: order } = await supabase
        .from('orders')
        .update({
          payment_status: 'completed',
          status: 'confirmed',
          mpesa_receipt_number: meta.MpesaReceiptNumber,
          paid_at: new Date().toISOString(),
        })
        .eq('mpesa_checkout_request_id', CheckoutRequestID)
        .select('*, buyer:profiles(full_name, phone)')
        .single();

      if (order) {
        const buyer = order.buyer as Record<string, unknown>;
        if (buyer?.phone) {
          const message = SMS_TEMPLATES.orderConfirmed(order.id, order.total);
          await sendSMS({ to: buyer.phone as string, message }).catch(console.error);
        }
      }
    } else {
      // Payment failed/cancelled
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', failure_reason: ResultDesc })
        .eq('mpesa_checkout_request_id', CheckoutRequestID);
    }

    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    console.error('M-Pesa callback error:', error);
    // Always return 200 to Safaricom
    return NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  }
}
