'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { createClient } from '@/lib/supabase/client';
import { Heart, Loader2, ShoppingBag } from 'lucide-react';
import Link from 'next/link';
import type { Listing } from '@/types';
import toast from 'react-hot-toast';

interface WishlistRow {
  id: string;
  listing: Listing;
}

export default function WishlistPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { addToCart } = useCart(profile?.id);
  const [items, setItems] = useState<WishlistRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
  }, [authLoading, profile, router]);

  const fetchWishlist = useCallback(async () => {
    if (!profile) return;
    const supabase = createClient();
    const { data } = await supabase
      .from('wishlists')
      .select(`id, listing:listings(*, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary), category:categories(name, slug))`)
      .eq('user_id', profile.id)
      .order('created_at', { ascending: false });
    setItems((data as unknown as WishlistRow[]) ?? []);
    setLoading(false);
  }, [profile]);

  useEffect(() => { fetchWishlist(); }, [fetchWishlist]);

  async function removeFromWishlist(wishlistId: string, listingTitle: string) {
    const supabase = createClient();
    const { error } = await supabase.from('wishlists').delete().eq('id', wishlistId);
    if (!error) {
      setItems((prev) => prev.filter((i) => i.id !== wishlistId));
      toast.success(`Removed "${listingTitle}" from wishlist`);
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-maasai-red/10 rounded-xl flex items-center justify-center">
          <Heart className="h-5 w-5 text-maasai-red" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">My Wishlist</h1>
          <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">
            {items.length} {items.length === 1 ? 'item' : 'items'} saved
          </p>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-24 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light">
          <Heart className="h-14 w-14 mx-auto text-maasai-beige mb-4" />
          <h2 className="text-xl font-bold text-maasai-black dark:text-white mb-2">Your wishlist is empty</h2>
          <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mb-6">
            Save items you love and come back to them later
          </p>
          <Link
            href="/marketplace"
            className="inline-flex items-center gap-2 px-6 py-3 bg-maasai-red text-white font-semibold rounded-xl hover:bg-maasai-red-dark transition-colors"
          >
            <ShoppingBag className="h-4 w-4" /> Browse Marketplace
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {items.map(({ id, listing }) => (
            <div key={id} className="relative group">
              <ProductCard
                listing={listing}
                userId={profile?.id}
                onAddToCart={addToCart}
              />
              <button
                onClick={() => removeFromWishlist(id, listing.title)}
                className="absolute top-2 right-2 z-10 p-1.5 bg-white/90 dark:bg-maasai-black/80 rounded-full text-maasai-red shadow-sm opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-50 dark:hover:bg-red-950/30"
                title="Remove from wishlist"
              >
                <Heart className="h-4 w-4 fill-current" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
