'use client';
import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Gavel, Package, Clock, CheckCircle2 } from 'lucide-react';
import type { Listing } from '@/types';
import { cn } from '@/lib/utils';

const TABS = [
  { id: 'active', label: 'Live Auctions', Icon: Gavel },
  { id: 'ending_soon', label: 'Ending Soon', Icon: Clock },
  { id: 'ended', label: 'Ended', Icon: CheckCircle2 },
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
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-10">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <div className="w-10 h-10 bg-maasai-red/10 rounded-xl flex items-center justify-center">
            <Gavel className="h-5 w-5 text-maasai-red" />
          </div>
          <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white tracking-tight">
            Live Auctions
          </h1>
          <span className="flex h-2 w-2 rounded-full bg-maasai-red animate-bead-pulse" />
        </div>
        <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm ml-[3.25rem]">
          Bid on authentic Maasai cultural items. Auctions run 6–12 hours.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 bg-maasai-beige/20 dark:bg-maasai-brown-light/20 p-1 rounded-xl w-fit max-w-full overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => (
          <button key={id} onClick={() => setTab(id)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-all duration-200',
              tab === id
                ? 'bg-white dark:bg-maasai-brown text-maasai-black dark:text-white shadow-sm'
                : 'text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-black dark:hover:text-white'
            )}>
            <Icon className="h-4 w-4" />
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-7 w-7 animate-spin text-maasai-red" />
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-24">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-maasai-beige/30 mb-5">
            <Package className="h-8 w-8 text-maasai-brown/40" />
          </div>
          <h3 className="font-semibold text-lg text-maasai-black dark:text-white mb-1">No auctions found</h3>
          <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm">
            {tab === 'ending_soon' ? 'No auctions ending within 2 hours.' : tab === 'ended' ? 'No ended auctions to display.' : 'Check back soon for new auctions.'}
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
