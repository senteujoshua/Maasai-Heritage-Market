import { NextRequest, NextResponse } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient } from '@/lib/supabase/server';
import { sendSMS, SMS_TEMPLATES } from '@/lib/africastalking/sms';
import { auditLog } from '@/lib/audit';

// Safaricom always expects { ResultCode: 0, ResultDesc: 'Accepted' } — do NOT change shape
const ACCEPTED = NextResponse.json({ ResultCode: 0, ResultDesc: 'Accepted' });

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { Body } = body;

    if (!Body?.stkCallback) return ACCEPTED;

    const { CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = Body.stkCallback;
    const supabase = await createAdminClient();

    if (ResultCode === 0) {
      // Parse metadata
      const meta: Record<string, string | number> = {};
      (CallbackMetadata?.Item || []).forEach((item: { Name: string; Value: string | number }) => {
        meta[item.Name] = item.Value;
      });

      // Idempotency: fetch order
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, payment_status, buyer:profiles(full_name, phone)')
        .eq('mpesa_checkout_request_id', CheckoutRequestID)
        .single();

      if (!existingOrder) return ACCEPTED;
      if (existingOrder.payment_status === 'paid') return ACCEPTED;

      const { data: order } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          mpesa_receipt_number: meta.MpesaReceiptNumber as string,
          paid_at: new Date().toISOString(),
        })
        .eq('id', existingOrder.id)
        .select('*, buyer:profiles(full_name, phone)')
        .single();

      if (order) {
        const buyer = order.buyer as Record<string, unknown>;
        auditLog({ actorId: existingOrder.id, action: 'payment_completed', entityType: 'order',
          entityId: existingOrder.id, payload: { method: 'mpesa', receipt: meta.MpesaReceiptNumber } });
        if (buyer?.phone) {
          const message = SMS_TEMPLATES.orderConfirmed(order.id, order.total);
          sendSMS({ to: buyer.phone as string, message }).catch(console.error);
        }
      }
    } else {
      await supabase
        .from('orders')
        .update({ payment_status: 'failed', failure_reason: ResultDesc })
        .eq('mpesa_checkout_request_id', CheckoutRequestID);
    }

    return ACCEPTED;
  } catch (error) {
    Sentry.captureException(error);
    // Always return 200 to Safaricom to prevent retries
    return ACCEPTED;
  }
}
