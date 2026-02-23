'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { Bid, Listing } from '@/types';
import toast from 'react-hot-toast';

export function useAuction(listingId: string, initialListing?: Listing) {
  const [listing, setListing] = useState<Listing | null>(initialListing || null);
  const [bids, setBids] = useState<Bid[]>([]);
  const [bidding, setBidding] = useState(false);
  const supabase = createClient();

  const fetchBids = useCallback(async () => {
    const { data } = await supabase
      .from('bids')
      .select('*, bidder:profiles(full_name, avatar_url)')
      .eq('listing_id', listingId)
      .order('amount', { ascending: false })
      .limit(20);
    setBids(data || []);
  }, [listingId, supabase]);

  const fetchListing = useCallback(async () => {
    const { data } = await supabase
      .from('listings')
      .select(`*, seller:profiles(id, full_name, avatar_url, is_verified, shop_name, rating), images:listing_images(image_url, is_primary, display_order), category:categories(name, slug)`)
      .eq('id', listingId)
      .single();
    if (data) setListing(data);
  }, [listingId, supabase]);

  useEffect(() => {
    fetchListing();
    fetchBids();

    const channel = supabase
      .channel(`auction:${listingId}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'bids', filter: `listing_id=eq.${listingId}` },
        (payload) => {
          const newBid = payload.new as Bid;
          setBids((prev) => [newBid, ...prev]);
          toast(`New bid: KES ${newBid.amount.toLocaleString()}!`, { icon: '🔔' });
          fetchListing();
        }
      )
      .on('postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'listings', filter: `id=eq.${listingId}` },
        (payload) => setListing((prev) => prev ? { ...prev, ...payload.new } : null)
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [listingId, fetchListing, fetchBids, supabase]);

  async function placeBid(amount: number, userId: string) {
    setBidding(true);
    try {
      const response = await fetch('/api/auctions/bid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ listingId, amount, userId }),
      });
      const result = await response.json();
      if (!response.ok) toast.error(result.error || 'Failed to place bid');
      else toast.success('Bid placed successfully!');
      return result;
    } finally {
      setBidding(false);
    }
  }

  return { listing, bids, bidding, placeBid, refetch: fetchListing };
}
