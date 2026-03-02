import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/africastalking/sms';
import { apiOk, apiError } from '@/lib/api-response';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return apiError('Unauthorized', 401);

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || !['admin', 'ceo', 'manager'].includes(profile.role)) {
      return apiError('Forbidden', 403);
    }

    const { to, message, bulk } = await req.json();
    if (!message) return apiError('Message is required', 400);

    if (bulk && Array.isArray(to)) {
      const results = await Promise.allSettled(
        to.map((phone: string) => sendSMS({ to: phone, message }))
      );
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      auditLog({ actorId: user.id, action: 'bulk_sms_sent', payload: { count: successful, total: to.length } });
      return apiOk({ sent: successful, total: to.length });
    } else if (to) {
      await sendSMS({ to, message });
      auditLog({ actorId: user.id, action: 'sms_sent', payload: { to } });
      return apiOk({ sent: true });
    } else {
      return apiError('Recipient(s) required', 400);
    }
  } catch (error: unknown) {
    Sentry.captureException(error);
    return apiError('Failed to send SMS', 500);
  }
}
