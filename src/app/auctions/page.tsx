'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Gavel, Package } from 'lucide-react';
import type { Listing } from '@/types';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'active', label: '🔔 Live Auctions' },
  { id: 'ending_soon', label: '⏰ Ending Soon' },
  { id: 'ended', label: '✅ Ended' },
];

export default function AuctionsPage() {
  const { profile } = useAuth();
  const { addToCart } = useCart(profile?.id);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState('active');

  const fetchAuctions = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    const now = new Date().toISOString();
    let query = supabase
      .from('listings')
      .select(`*, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary), category:categories(name, slug)`)
      .eq('listing_type', 'auction')
      .eq('is_approved', true);

    if (tab === 'active') {
      query = query.eq('status', 'active').gt('auction_end_time', now).order('auction_end_time', { ascending: true });
    } else if (tab === 'ending_soon') {
      const twoHoursFromNow = new Date(Date.now() + 2 * 60 * 60 * 1000).toISOString();
      query = query.eq('status', 'active').gt('auction_end_time', now).lte('auction_end_time', twoHoursFromNow).order('auction_end_time', { ascending: true });
    } else {
      query = query.in('status', ['ended', 'sold']).order('auction_end_time', { ascending: false }).limit(20);
    }

    const { data } = await query;
    setListings(data || []);
    setLoading(false);
  }, [tab]);

  useEffect(() => { fetchAuctions(); }, [fetchAuctions]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-maasai-red/10 rounded-xl flex items-center justify-center">
            <Gavel className="h-5 w-5 text-maasai-red" />
          </div>
          <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">Live Auctions</h1>
          <span className="flex h-2.5 w-2.5 rounded-full bg-maasai-red animate-bead-pulse" />
        </div>
        <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm ml-13">
          Bid on authentic Maasai cultural items. Auctions run 6–12 hours.
        </p>
      </div>

      <div className="flex gap-2 mb-6 border-b border-maasai-beige/40 dark:border-maasai-brown-light">
        {TABS.map(({ id, label }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn('px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px', tab === id ? 'border-maasai-red text-maasai-red' : 'border-transparent text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red')}>
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-24">
          <Package className="h-16 w-16 mx-auto text-maasai-beige mb-4" />
          <h3 className="font-bold text-lg text-maasai-black dark:text-white mb-1">No auctions found</h3>
          <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm">
            {tab === 'ending_soon' ? 'No auctions ending within 2 hours.' : tab === 'ended' ? 'No ended auctions to display.' : 'Check back soon for new auctions!'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {listings.map((listing) => (
            <ProductCard key={listing.id} listing={listing} userId={profile?.id} onAddToCart={addToCart} />
          ))}
        </div>
      )}
    </div>
  );
}
