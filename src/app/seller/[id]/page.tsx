'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { VerifiedArtisanBadge } from '@/components/ui/Badge';
import { formatKES, formatDate } from '@/lib/utils';
import {
  Star, Package, ShoppingBag, MapPin, MessageSquare, Loader2, AlertTriangle, ShieldCheck,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Profile, Listing } from '@/types';

const TABS = ['All', 'Fixed Price', 'Auctions'] as const;
type Tab = typeof TABS[number];

export default function SellerProfilePage() {
  const { id } = useParams<{ id: string }>();
  const { profile: currentUser } = useAuth();
  const { addToCart } = useCart(currentUser?.id);
  const [seller, setSeller] = useState<Profile | null>(null);
  const [listings, setListings] = useState<Listing[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('All');

  const fetchSeller = useCallback(async () => {
    const supabase = createClient();
    const [profileRes, listingsRes] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', id).single(),
      supabase
        .from('listings')
        .select(`*, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary), category:categories(name, slug)`)
        .eq('seller_id', id)
        .eq('status', 'active')
        .eq('is_approved', true)
        .order('created_at', { ascending: false }),
    ]);
    setSeller(profileRes.data as Profile);
    setListings((listingsRes.data as unknown as Listing[]) ?? []);
    setLoading(false);
  }, [id]);

  useEffect(() => { fetchSeller(); }, [fetchSeller]);

  const filteredListings = listings.filter((l) => {
    if (tab === 'Fixed Price') return l.listing_type === 'fixed';
    if (tab === 'Auctions') return l.listing_type === 'auction';
    return true;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  if (!seller) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-maasai-beige mb-4" />
        <h2 className="text-xl font-bold text-maasai-black dark:text-white mb-2">Seller not found</h2>
        <Link href="/marketplace" className="text-maasai-red hover:underline text-sm">
          Back to Marketplace
        </Link>
      </div>
    );
  }

  const isOwnProfile = currentUser?.id === seller.id;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Seller hero */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-6 mb-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Avatar */}
          <div className="w-20 h-20 rounded-full bg-maasai-gradient flex items-center justify-center text-white text-3xl font-bold flex-shrink-0 overflow-hidden shadow-maasai">
            {seller.avatar_url ? (
              <Image src={seller.avatar_url} alt={seller.full_name} width={80} height={80} className="object-cover w-full h-full" />
            ) : (
              seller.full_name?.charAt(0)?.toUpperCase()
            )}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">
                {seller.shop_name || seller.full_name}
              </h1>
              {seller.is_verified && <VerifiedArtisanBadge />}
            </div>
            {seller.shop_name && (
              <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-2">{seller.full_name}</p>
            )}
            {seller.bio && (
              <p className="text-sm text-maasai-brown/80 dark:text-maasai-beige/80 mb-3 leading-relaxed max-w-xl">
                {seller.bio}
              </p>
            )}
            <div className="flex flex-wrap items-center gap-4 text-sm text-maasai-brown/60 dark:text-maasai-beige/60">
              {seller.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3.5 w-3.5" /> {seller.location}
                </span>
              )}
              <span className="flex items-center gap-1">
                <ShoppingBag className="h-3.5 w-3.5" /> {seller.total_sales.toLocaleString()} sales
              </span>
              <span className="flex items-center gap-1">
                <Star className="h-3.5 w-3.5 text-maasai-gold fill-current" />
                {Number(seller.rating || 0).toFixed(1)} rating
              </span>
              <span className="flex items-center gap-1">
                <Package className="h-3.5 w-3.5" /> {listings.length} active listings
              </span>
              <span className="text-xs">Member since {formatDate(seller.created_at)}</span>
            </div>
          </div>

          {/* Actions */}
          {!isOwnProfile && currentUser && (
            <Link
              href={`/messages?to=${seller.id}`}
              className="flex items-center gap-2 px-4 py-2.5 border-2 border-maasai-red text-maasai-red hover:bg-maasai-red hover:text-white font-semibold text-sm rounded-xl transition-colors flex-shrink-0"
            >
              <MessageSquare className="h-4 w-4" /> Message Seller
            </Link>
          )}
          {isOwnProfile && (
            <Link
              href="/seller/dashboard"
              className="flex items-center gap-2 px-4 py-2.5 bg-maasai-red text-white font-semibold text-sm rounded-xl hover:bg-maasai-red-dark transition-colors flex-shrink-0"
            >
              Go to Dashboard
            </Link>
          )}
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-maasai-beige/30 dark:border-maasai-brown-light">
          {[
            { label: 'Total Sales', value: seller.total_sales.toLocaleString(), icon: ShoppingBag },
            { label: 'Rating', value: `${Number(seller.rating || 0).toFixed(1)} / 5`, icon: Star },
            { label: 'Listings', value: listings.length, icon: Package },
            { label: 'Verified', value: seller.is_verified ? 'Yes' : 'Pending', icon: ShieldCheck, hidden: !seller.is_verified },
          ].filter(s => !s.hidden).map(({ label, value, icon: Icon }) => (
            <div key={label} className="text-center p-3 bg-maasai-beige/10 dark:bg-maasai-brown-light/20 rounded-xl">
              <Icon className="h-4 w-4 mx-auto mb-1 text-maasai-red" />
              <p className="font-bold text-maasai-black dark:text-white text-lg">{value}</p>
              <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Listings section */}
      <div>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold font-display text-maasai-black dark:text-white">
            {seller.shop_name ? `${seller.shop_name}'s` : 'Active'} Listings
          </h2>
          {/* Tabs */}
          <div className="flex gap-1 bg-maasai-beige/20 dark:bg-maasai-brown-light/20 p-1 rounded-xl">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold rounded-lg transition-all',
                  tab === t
                    ? 'bg-white dark:bg-maasai-brown text-maasai-black dark:text-white shadow-sm'
                    : 'text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-black dark:hover:text-white'
                )}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        {filteredListings.length === 0 ? (
          <div className="text-center py-20 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light">
            <Package className="h-12 w-12 mx-auto text-maasai-beige mb-3" />
            <p className="font-semibold text-maasai-black dark:text-white">No listings in this category</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {filteredListings.map((listing) => (
              <ProductCard
                key={listing.id}
                listing={listing}
                userId={currentUser?.id}
                onAddToCart={addToCart}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
