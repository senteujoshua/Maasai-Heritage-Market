'use client';
import { Suspense, useEffect, useState, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { CategoryFilter } from '@/components/marketplace/CategoryFilter';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { SortAsc, Grid3X3, List, Loader2, Package } from 'lucide-react';
import type { Listing, SearchFilters } from '@/types';
import { cn } from '@/lib/utils';

const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'price_asc', label: 'Price: Low to High' },
  { value: 'price_desc', label: 'Price: High to Low' },
  { value: 'ending_soon', label: 'Ending Soon' },
  { value: 'most_bids', label: 'Most Bids' },
];

const PAGE_SIZE = 20;

function MarketplaceContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { profile } = useAuth();
  const { addToCart } = useCart(profile?.id);

  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [view, setView] = useState<'grid' | 'list'>('grid');

  const [filters, setFilters] = useState<SearchFilters>({
    query: searchParams.get('q') || undefined,
    category: searchParams.get('category') || undefined,
    listing_type: (searchParams.get('type') as 'fixed' | 'auction') || undefined,
    region: searchParams.get('region') || undefined,
    sort_by: 'newest',
  });

  const fetchListings = useCallback(async () => {
    setLoading(true);
    const supabase = createClient();
    let query = supabase
      .from('listings')
      .select(`*, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary), category:categories(name, slug)`, { count: 'exact' })
      .eq('status', 'active')
      .eq('is_approved', true);

    if (filters.query) query = query.or(`title.ilike.%${filters.query}%,description.ilike.%${filters.query}%`);
    if (filters.listing_type && filters.listing_type !== 'all') query = query.eq('listing_type', filters.listing_type);
    if (filters.region) query = query.eq('region', filters.region);
    if (filters.min_price) query = query.gte('price', filters.min_price);
    if (filters.max_price) query = query.lte('price', filters.max_price);

    switch (filters.sort_by) {
      case 'price_asc': query = query.order('price', { ascending: true }); break;
      case 'price_desc': query = query.order('price', { ascending: false }); break;
      case 'ending_soon': query = query.order('auction_end_time', { ascending: true, nullsFirst: false }); break;
      case 'most_bids': query = query.order('bid_count', { ascending: false }); break;
      default: query = query.order('created_at', { ascending: false });
    }

    const from = (page - 1) * PAGE_SIZE;
    const { data, count } = await query.range(from, from + PAGE_SIZE - 1);
    setListings(data || []);
    setTotal(count || 0);
    setLoading(false);
  }, [filters, page]);

  useEffect(() => { fetchListings(); }, [fetchListings]);

  function handleFiltersChange(newFilters: SearchFilters) {
    setFilters(newFilters);
    setPage(1);
    const params = new URLSearchParams();
    if (newFilters.query) params.set('q', newFilters.query);
    if (newFilters.category) params.set('category', newFilters.category);
    if (newFilters.listing_type) params.set('type', newFilters.listing_type);
    if (newFilters.region) params.set('region', newFilters.region);
    router.push(`/marketplace?${params.toString()}`, { scroll: false });
  }

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">
          {filters.query ? `Results for "${filters.query}"` : filters.category ? filters.category.split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ') : 'All Items'}
        </h1>
        <p className="text-maasai-brown/60 dark:text-maasai-beige/60 mt-1 text-sm">
          {loading ? 'Loading...' : `${total.toLocaleString()} item${total !== 1 ? 's' : ''} found`}
        </p>
      </div>

      <div className="flex gap-6">
        <div className="w-60 flex-shrink-0">
          <CategoryFilter filters={filters} onChange={handleFiltersChange} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-3 mb-5">
            <div className="flex items-center gap-2">
              <SortAsc className="h-4 w-4 text-maasai-brown/60 flex-shrink-0" />
              <select value={filters.sort_by} onChange={(e) => setFilters((prev) => ({ ...prev, sort_by: e.target.value as SearchFilters['sort_by'] }))}
                className="text-sm border border-maasai-beige dark:border-maasai-brown-light rounded-lg px-3 py-1.5 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white focus:outline-none focus:ring-2 focus:ring-maasai-red">
                {SORT_OPTIONS.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
              </select>
            </div>
            <div className="flex items-center gap-1 border border-maasai-beige dark:border-maasai-brown-light rounded-lg p-0.5">
              {(['grid', 'list'] as const).map((v) => (
                <button key={v} onClick={() => setView(v)}
                  className={cn('p-1.5 rounded-md transition-colors', view === v ? 'bg-maasai-red text-white' : 'text-maasai-brown/60 hover:bg-maasai-beige/30')}>
                  {v === 'grid' ? <Grid3X3 className="h-4 w-4" /> : <List className="h-4 w-4" />}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>
          ) : listings.length === 0 ? (
            <div className="text-center py-20">
              <Package className="h-16 w-16 mx-auto text-maasai-beige mb-4" />
              <h3 className="font-bold text-lg text-maasai-black dark:text-white mb-2">No items found</h3>
              <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm">Try adjusting your filters or search term</p>
            </div>
          ) : (
            <div className={cn('grid gap-4', view === 'grid' ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-4' : 'grid-cols-1')}>
              {listings.map((listing) => <ProductCard key={listing.id} listing={listing} userId={profile?.id} onAddToCart={addToCart} />)}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 mt-8">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}
                className="px-4 py-2 text-sm font-medium border border-maasai-beige dark:border-maasai-brown-light rounded-lg disabled:opacity-50 hover:bg-maasai-beige/30 text-maasai-brown dark:text-maasai-beige">
                Previous
              </button>
              <span className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70">Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}
                className="px-4 py-2 text-sm font-medium border border-maasai-beige dark:border-maasai-brown-light rounded-lg disabled:opacity-50 hover:bg-maasai-beige/30 text-maasai-brown dark:text-maasai-beige">
                Next
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function MarketplacePage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    }>
      <MarketplaceContent />
    </Suspense>
  );
}
