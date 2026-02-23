import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { createClient } from '@/lib/supabase/server';
import { sendSMS, SMS_TEMPLATES } from '@/lib/africastalking/sms';

export async function POST(req: NextRequest) {
  try {
    const { listingId, amount } = await req.json();

    if (!listingId || !amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid bid parameters' }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createClient();
    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const adminSupabase = await createAdminClient();

    // Get listing with lock
    const { data: listing, error: listingError } = await adminSupabase
      .from('listings')
      .select('*, seller:profiles(id, phone, full_name)')
      .eq('id', listingId)
      .eq('listing_type', 'auction')
      .eq('status', 'active')
      .eq('is_approved', true)
      .single();

    if (listingError || !listing) {
      return NextResponse.json({ error: 'Listing not found or auction has ended' }, { status: 404 });
    }

    const seller = listing.seller as Record<string, unknown>;

    // Check auction hasn't ended
    if (listing.auction_end_time && new Date(listing.auction_end_time) <= new Date()) {
      return NextResponse.json({ error: 'This auction has ended' }, { status: 400 });
    }

    // Check bidder is not the seller
    if (user.id === seller?.id) {
      return NextResponse.json({ error: 'You cannot bid on your own listing' }, { status: 400 });
    }

    const currentBid = listing.current_bid || listing.price || 0;
    const minBid = currentBid + 100;

    if (amount < minBid) {
      return NextResponse.json({ error: `Minimum bid is ${minBid} KES` }, { status: 400 });
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
      .insert({
        listing_id: listingId,
        bidder_id: user.id,
        amount,
        is_winning: true,
      })
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

    // Send outbid SMS to previous highest bidder
    if (prevBid) {
      const prevBidder = prevBid.bidder as Record<string, unknown>;
      if (prevBidder?.phone && prevBidder?.id !== user.id) {
        const message = SMS_TEMPLATES.outbid(listing.title, amount, listingId);
        sendSMS({ to: prevBidder.phone as string, message }).catch(console.error);
      }
    }

    return NextResponse.json({
      success: true,
      bid: newBid,
      newCurrentBid: amount,
    });
  } catch (error: unknown) {
    console.error('Bid error:', error);
    const message = error instanceof Error ? error.message : 'Failed to place bid';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
