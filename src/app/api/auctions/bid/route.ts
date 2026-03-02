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

    // Atomic bid placement via row-locked RPC (prevents race conditions)
    const { data: result, error: rpcError } = await adminSupabase
      .rpc('place_bid', {
        p_listing_id: listingId,
        p_bidder_id:  user.id,
        p_amount:     amount,
      });

    if (rpcError) {
      const msg = rpcError.message ?? '';
      if (msg.includes('listing_not_found'))      return apiError('Listing not found', 404);
      if (msg.includes('not_an_auction'))          return apiError('Not an auction listing', 400);
      if (msg.includes('auction_not_active'))      return apiError('Auction is not active', 400);
      if (msg.includes('auction_ended'))           return apiError('This auction has ended', 400);
      if (msg.includes('cannot_bid_own_listing'))  return apiError('You cannot bid on your own listing', 400);
      if (msg.includes('bid_too_low')) {
        const min = msg.split(':')[1]?.trim() ?? '0';
        return apiError(`Minimum bid is ${min} KES`, 400);
      }
      throw rpcError;
    }

    const { bid_id, new_current_bid, bid_count } = result as {
      bid_id: string; new_current_bid: number; bid_count: number;
    };

    // Audit
    auditLog({ actorId: user.id, action: 'bid_placed', entityType: 'listing', entityId: listingId,
      payload: { amount, new_current_bid, bid_count } });

    // Notify previous highest bidder (best-effort, non-blocking)
    const { data: prevBid } = await adminSupabase
      .from('bids')
      .select('bidder_id, bidder:profiles(phone)')
      .eq('listing_id', listingId)
      .eq('is_winning', false)
      .order('amount', { ascending: false })
      .limit(1)
      .single();

    if (prevBid) {
      const prevBidder = prevBid.bidder as unknown as Record<string, unknown>;
      const phone = prevBidder?.phone as string | undefined;
      if (phone && prevBid.bidder_id !== user.id) {
        const { data: listing } = await adminSupabase
          .from('listings').select('title').eq('id', listingId).single();
        if (listing) {
          sendSMS({ to: phone, message: SMS_TEMPLATES.outbid(listing.title, new_current_bid, listingId) })
            .catch(console.error);
        }
      }
    }

    return apiOk({ bid_id, newCurrentBid: new_current_bid, bidCount: bid_count });
  } catch (error: unknown) {
    Sentry.captureException(error);
    const message = error instanceof Error ? error.message : 'Failed to place bid';
    return apiError(message, 500);
  }
}
