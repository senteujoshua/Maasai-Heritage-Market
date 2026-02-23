import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS } from '@/lib/africastalking/sms';

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
    if (!profile || profile.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { to, message, bulk } = await req.json();
    if (!message) return NextResponse.json({ error: 'Message is required' }, { status: 400 });

    if (bulk && Array.isArray(to)) {
      // Send to multiple recipients
      const results = await Promise.allSettled(
        to.map((phone: string) => sendSMS({ to: phone, message }))
      );
      const successful = results.filter((r) => r.status === 'fulfilled').length;
      return NextResponse.json({ success: true, sent: successful, total: to.length });
    } else if (to) {
      await sendSMS({ to, message });
      return NextResponse.json({ success: true });
    } else {
      return NextResponse.json({ error: 'Recipient(s) required' }, { status: 400 });
    }
  } catch (error: unknown) {
    console.error('SMS route error:', error);
    return NextResponse.json({ error: 'Failed to send SMS' }, { status: 500 });
  }
}
