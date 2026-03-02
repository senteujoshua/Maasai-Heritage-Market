import { NextRequest } from 'next/server';
import * as Sentry from '@sentry/nextjs';
import { createAdminClient, createClient } from '@/lib/supabase/server';
import { sendSMS, SMS_TEMPLATES } from '@/lib/africastalking/sms';
import { apiOk, apiError } from '@/lib/api-response';
import { auditLog } from '@/lib/audit';

export async function POST(req: NextRequest) {
  try {
    const { listingId, amount } = await req.json();

    if (!listingId || !amount || amount <= 0) {
      return apiError('Invalid bid parameters', 400);
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) return apiError('Unauthorized', 401);

    const adminSupabase = await createAdminClient();

    // Get listing
    const { data: listing, error: listingError } = await adminSupabase
      .from('listings')
      .select('*, seller:profiles(id, phone, full_name)')
      .eq('id', listingId)
      .eq('listing_type', 'auction')
      .eq('status', 'active')
      .eq('is_approved', true)
      .single();

    if (listingError || !listing) {
      return apiError('Listing not found or auction has ended', 404);
    }

    const seller = listing.seller as Record<string, unknown>;

    if (listing.auction_end_time && new Date(listing.auction_end_time) <= new Date()) {
      return apiError('This auction has ended', 400);
    }

    if (user.id === seller?.id) {
      return apiError('You cannot bid on your own listing', 400);
    }

    const currentBid = listing.current_bid || listing.price || 0;
    const minBid = currentBid + 100;

    if (amount < minBid) {
      return apiError(`Minimum bid is ${minBid} KES`, 400);
    }

    // Get previous highest bidder for outbid notification
    const { data: prevBid } = await adminSupabase
      .from('bids')
      .select('*, bidder:profiles(phone, full_name)')
      .eq('listing_id', listingId)
      .eq('is_winning', true)
      .single();

    // Insert bid
    const { data: newBid, error: bidError } = await adminSupabase
      .from('bids')
      .insert({ listing_id: listingId, bidder_id: user.id, amount, is_winning: true })
      .select()
      .single();

    if (bidError) throw bidError;

    // Update previous winning bid
    if (prevBid?.id) {
      await adminSupabase.from('bids').update({ is_winning: false }).eq('id', prevBid.id);
    }

    // Update listing current_bid and bid_count
    await adminSupabase.from('listings').update({
      current_bid: amount,
      bid_count: (listing.bid_count || 0) + 1,
    }).eq('id', listingId);

    // Audit
    auditLog({ actorId: user.id, action: 'bid_placed', entityType: 'listing', entityId: listingId,
      payload: { amount, previous_bid: currentBid } });

    // Outbid SMS
    if (prevBid) {
      const prevBidder = prevBid.bidder as Record<string, unknown>;
      if (prevBidder?.phone && prevBidder?.id !== user.id) {
        const message = SMS_TEMPLATES.outbid(listing.title, amount, listingId);
        sendSMS({ to: prevBidder.phone as string, message }).catch(console.error);
      }
    }

    return apiOk({ bid: newBid, newCurrentBid: amount });
  } catch (error: unknown) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Failed to place bid';
    return apiError(message, 500);
  }
}
