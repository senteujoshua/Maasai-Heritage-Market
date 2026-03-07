import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { apiOk, apiError } from '@/lib/api-response';
import {
  sendEmail,
  sellerVerifiedHtml,
  sellerVerificationRejectedHtml,
} from '@/lib/email';

const STAFF_ROLES = ['admin', 'ceo', 'manager'];

export async function POST(req: NextRequest) {
  const supabase      = await createClient();
  const adminSupabase = await createAdminClient();

  // Auth + role check
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return apiError('Unauthorized', 401);

  const { data: caller } = await adminSupabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!caller || !STAFF_ROLES.includes(caller.role)) {
    return apiError('Forbidden', 403);
  }

  const { userId, action, reason } = await req.json() as {
    userId: string;
    action: 'approve' | 'reject';
    reason?: string;
  };

  if (!userId || !action) return apiError('Missing userId or action', 400);
  if (action === 'reject' && !reason?.trim()) return apiError('Rejection reason required', 400);

  // Fetch seller profile for email
  const { data: seller } = await adminSupabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', userId)
    .single();

  if (!seller) return apiError('User not found', 404);

  if (action === 'approve') {
    const { error } = await adminSupabase
      .from('profiles')
      .update({ verification_status: 'approved', is_verified: true })
      .eq('id', userId);
    if (error) return apiError(error.message, 500);

    if (seller.email) {
      sendEmail({
        to:      seller.email,
        subject: 'You\'re now a Verified Artisan on Maasai Heritage Market!',
        html:    sellerVerifiedHtml({ sellerName: seller.full_name }),
      }).catch(console.error);
    }
  } else {
    const { error } = await adminSupabase
      .from('profiles')
      .update({ verification_status: 'rejected', is_verified: false, rejection_reason: reason })
      .eq('id', userId);
    if (error) return apiError(error.message, 500);

    if (seller.email) {
      sendEmail({
        to:      seller.email,
        subject: 'Verification update — Maasai Heritage Market',
        html:    sellerVerificationRejectedHtml({ sellerName: seller.full_name, reason: reason! }),
      }).catch(console.error);
    }
  }

  return apiOk({ success: true });
}
