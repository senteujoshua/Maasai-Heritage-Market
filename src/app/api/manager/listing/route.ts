import { NextRequest } from 'next/server';
import { createClient, createAdminClient } from '@/lib/supabase/server';
import { apiOk, apiError } from '@/lib/api-response';
import { sendEmail, listingApprovedHtml, listingRejectedHtml } from '@/lib/email';

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

  const { listingId, action, reason } = await req.json() as {
    listingId: string;
    action:    'approve' | 'reject';
    reason?:   string;
  };

  if (!listingId || !action) return apiError('Missing listingId or action', 400);
  if (action === 'reject' && !reason?.trim()) return apiError('Rejection reason required', 400);

  // Fetch listing + seller email
  const { data: listing } = await adminSupabase
    .from('listings')
    .select('id, title, seller:profiles!seller_id(full_name, email)')
    .eq('id', listingId)
    .single();

  if (!listing) return apiError('Listing not found', 404);

  const seller = listing.seller as unknown as { full_name: string; email: string } | null;

  if (action === 'approve') {
    const { error } = await adminSupabase
      .from('listings')
      .update({ status: 'active', is_approved: true })
      .eq('id', listingId);
    if (error) return apiError(error.message, 500);

    if (seller?.email) {
      sendEmail({
        to:      seller.email,
        subject: `Your listing "${listing.title}" is now live!`,
        html:    listingApprovedHtml({
          sellerName:   seller.full_name,
          listingTitle: listing.title,
          listingId:    listing.id,
        }),
      }).catch(console.error);
    }
  } else {
    const { error } = await adminSupabase
      .from('listings')
      .update({ status: 'rejected', is_approved: false, rejection_reason: reason })
      .eq('id', listingId);
    if (error) return apiError(error.message, 500);

    if (seller?.email) {
      sendEmail({
        to:      seller.email,
        subject: `Listing update — "${listing.title}"`,
        html:    listingRejectedHtml({
          sellerName:   seller.full_name,
          listingTitle: listing.title,
          reason:       reason!,
        }),
      }).catch(console.error);
    }
  }

  return apiOk({ success: true });
}
