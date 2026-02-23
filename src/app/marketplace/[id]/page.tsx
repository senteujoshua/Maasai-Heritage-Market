'use client';
import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { useAuction } from '@/hooks/useAuction';
import { AuctionTimerCard } from '@/components/marketplace/AuctionTimer';
import { BidForm } from '@/components/marketplace/BidForm';
import { VerifiedArtisanBadge, Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatKES, timeAgo, formatDate } from '@/lib/utils';
import {
  ShoppingCart, Heart, Share2, ChevronLeft, ChevronRight, MapPin,
  Package, Star, Eye, MessageSquare, Shield, Loader2, AlertTriangle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import type { Listing, Review } from '@/types';

export default function ProductDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuth();
  const { addToCart } = useCart(profile?.id);

  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeImageIndex, setActiveImageIndex] = useState(0);
  const [wishlisted, setWishlisted] = useState(false);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [addingToCart, setAddingToCart] = useState(false);

  const { currentBid, bidCount, placeBid, biddingLoading } = useAuction(
    listing?.listing_type === 'auction' ? id : null,
    listing?.current_bid || listing?.price || 0,
    listing?.bid_count || 0
  );

  const fetchListing = useCallback(async () => {
    const supabase = createClient();
    const { data } = await supabase
      .from('listings')
      .select(`*, seller:profiles(id, full_name, shop_name, is_verified, rating, total_sales, profile_picture_url, created_at), images:listing_images(id, image_url, is_primary), category:categories(name, slug)`)
      .eq('id', id)
      .single();

    if (data) {
      setListing(data as Listing);
      // Increment views
      await supabase.rpc('increment_listing_views', { listing_id: id });
      // Check wishlist
      if (profile?.id) {
        const { data: wl } = await supabase.from('wishlists').select('id').eq('user_id', profile.id).eq('listing_id', id).single();
        setWishlisted(!!wl);
      }
      // Fetch reviews
      const { data: revData } = await supabase
        .from('reviews')
        .select('*, reviewer:profiles(full_name, profile_picture_url)')
        .eq('listing_id', id)
        .order('created_at', { ascending: false })
        .limit(5);
      setReviews(revData || []);
    }
    setLoading(false);
  }, [id, profile?.id]);

  useEffect(() => { fetchListing(); }, [fetchListing]);

  async function handleWishlist() {
    if (!profile) { router.push('/login'); return; }
    const supabase = createClient();
    if (wishlisted) {
      await supabase.from('wishlists').delete().eq('user_id', profile.id).eq('listing_id', id);
      setWishlisted(false);
      toast.success('Removed from wishlist');
    } else {
      await supabase.from('wishlists').insert({ user_id: profile.id, listing_id: id });
      setWishlisted(true);
      toast.success('Added to wishlist');
    }
  }

  async function handleAddToCart() {
    if (!profile) { router.push('/login'); return; }
    setAddingToCart(true);
    await addToCart(id, 1);
    setAddingToCart(false);
  }

  function handleShare() {
    if (navigator.share) {
      navigator.share({ title: listing?.title, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
      toast.success('Link copied!');
    }
  }

  const images = listing?.images || [];
  const sortedImages = [...images].sort((a, b) => (b.is_primary ? 1 : 0) - (a.is_primary ? 1 : 0));
  const isAuction = listing?.listing_type === 'auction';
  const isOwner = profile?.id === (listing?.seller as Record<string, unknown>)?.id;
  const isSold = listing?.status === 'sold';

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-10 w-10 animate-spin text-maasai-red" />
      </div>
    );
  }

  if (!listing) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-16 w-16 mx-auto text-maasai-beige mb-4" />
        <h2 className="text-xl font-bold text-maasai-black dark:text-white">Item not found</h2>
        <Link href="/marketplace" className="text-maasai-red mt-4 inline-block hover:underline">Back to Marketplace</Link>
      </div>
    );
  }

  const seller = listing.seller as Record<string, unknown>;
  const category = listing.category as Record<string, unknown>;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mb-6">
        <Link href="/marketplace" className="hover:text-maasai-red transition-colors">Marketplace</Link>
        <span>/</span>
        {category && <Link href={`/marketplace?category=${category.slug}`} className="hover:text-maasai-red transition-colors">{category.name as string}</Link>}
        <span>/</span>
        <span className="text-maasai-black dark:text-white truncate max-w-xs">{listing.title}</span>
      </nav>

      <div className="grid lg:grid-cols-2 gap-10">
        {/* IMAGE GALLERY */}
        <div className="space-y-3">
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-maasai-beige/20">
            {sortedImages.length > 0 ? (
              <Image
                src={sortedImages[activeImageIndex]?.image_url}
                alt={listing.title}
                fill className="object-cover"
              />
            ) : (
              <div className="absolute inset-0 flex items-center justify-center">
                <Package className="h-20 w-20 text-maasai-beige" />
              </div>
            )}
            {sortedImages.length > 1 && (
              <>
                <button onClick={() => setActiveImageIndex((i) => (i - 1 + sortedImages.length) % sortedImages.length)}
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 dark:bg-maasai-black/70 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors">
                  <ChevronLeft className="h-5 w-5" />
                </button>
                <button onClick={() => setActiveImageIndex((i) => (i + 1) % sortedImages.length)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 bg-white/80 dark:bg-maasai-black/70 rounded-full flex items-center justify-center shadow hover:bg-white transition-colors">
                  <ChevronRight className="h-5 w-5" />
                </button>
              </>
            )}
            <div className="absolute top-3 left-3 flex flex-col gap-1.5">
              {isAuction && <Badge variant="auction">🔔 Live Auction</Badge>}
              {isSold && <Badge variant="sold">Sold</Badge>}
            </div>
            <div className="absolute bottom-3 left-3 flex items-center gap-1.5 bg-maasai-black/50 rounded-full px-2.5 py-1">
              <Eye className="h-3.5 w-3.5 text-white" />
              <span className="text-white text-xs font-medium">{(listing.views || 0).toLocaleString()} views</span>
            </div>
          </div>
          {sortedImages.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-1">
              {sortedImages.map((img, i) => (
                <button key={img.id} onClick={() => setActiveImageIndex(i)}
                  className={cn('w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden border-2 transition-colors', activeImageIndex === i ? 'border-maasai-red' : 'border-transparent hover:border-maasai-beige')}>
                  <Image src={img.image_url} alt="" width={64} height={64} className="object-cover w-full h-full" />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* PRODUCT INFO */}
        <div className="space-y-5">
          <div>
            <div className="flex items-start justify-between gap-3 mb-2">
              <h1 className="text-2xl sm:text-3xl font-bold font-display text-maasai-black dark:text-white leading-tight">{listing.title}</h1>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={handleWishlist} className={cn('p-2 rounded-full border transition-colors', wishlisted ? 'bg-maasai-red/10 border-maasai-red text-maasai-red' : 'border-maasai-beige dark:border-maasai-brown-light text-maasai-brown/50 hover:border-maasai-red hover:text-maasai-red')}>
                  <Heart className={cn('h-5 w-5', wishlisted && 'fill-current')} />
                </button>
                <button onClick={handleShare} className="p-2 rounded-full border border-maasai-beige dark:border-maasai-brown-light text-maasai-brown/50 hover:border-maasai-red hover:text-maasai-red transition-colors">
                  <Share2 className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Seller */}
            <div className="flex items-center gap-2 mb-3">
              {seller?.is_verified && <VerifiedArtisanBadge />}
              <span className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70">
                by <Link href={`/seller/${seller?.id}`} className="text-maasai-red font-semibold hover:underline">{(seller?.shop_name || seller?.full_name) as string}</Link>
              </span>
              {listing.region && (
                <span className="flex items-center gap-1 text-xs text-maasai-brown/50 dark:text-maasai-beige/50">
                  <MapPin className="h-3 w-3" />{listing.region}
                </span>
              )}
            </div>
          </div>

          {/* PRICING */}
          {isAuction ? (
            <div className="bg-maasai-red/5 dark:bg-maasai-red/10 rounded-2xl p-5 border border-maasai-red/20">
              <AuctionTimerCard listing={{ ...listing, current_bid: currentBid, bid_count: bidCount }} />
              {!isOwner && !isSold && (
                <div className="mt-4">
                  <BidForm
                    listingId={id}
                    currentBid={currentBid}
                    minBid={currentBid + 100}
                    onBid={placeBid}
                    loading={biddingLoading}
                    userId={profile?.id}
                  />
                </div>
              )}
            </div>
          ) : (
            <div>
              <div className="flex items-baseline gap-3 mb-4">
                <span className="text-3xl font-bold text-maasai-red">{formatKES(listing.price)}</span>
                {listing.price > 5000 && (
                  <span className="text-sm text-maasai-brown/50 dark:text-maasai-beige/50">
                    or ~{formatKES(Math.ceil(listing.price / 3))}/mo (3 installments)
                  </span>
                )}
              </div>
              {!isOwner && !isSold && (
                <div className="flex gap-3">
                  <Button variant="primary" size="lg" onClick={handleAddToCart} loading={addingToCart} className="flex-1">
                    <ShoppingCart className="h-5 w-5 mr-2" /> Add to Cart
                  </Button>
                  <Button variant="outline" size="lg" onClick={() => { handleAddToCart().then(() => router.push('/checkout')); }} className="flex-1">
                    Buy Now
                  </Button>
                </div>
              )}
              {isSold && <Badge variant="sold" className="text-base px-4 py-2">This item has been sold</Badge>}
            </div>
          )}

          {/* TRUST */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { icon: Shield, label: 'Buyer Protection', sub: '7-day returns' },
              { icon: Package, label: 'Secure Delivery', sub: 'G4S / Aramex' },
              { icon: Star, label: 'Authentic', sub: 'Verified artisan' },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex flex-col items-center text-center p-3 rounded-xl bg-maasai-beige/10 dark:bg-maasai-brown-light/20">
                <Icon className="h-5 w-5 text-maasai-red mb-1" />
                <p className="text-xs font-semibold text-maasai-black dark:text-white">{label}</p>
                <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50">{sub}</p>
              </div>
            ))}
          </div>

          {/* DESCRIPTION */}
          <div>
            <h3 className="font-bold text-maasai-black dark:text-white mb-2">Description</h3>
            <p className="text-sm text-maasai-brown/80 dark:text-maasai-beige/80 leading-relaxed whitespace-pre-line">{listing.description}</p>
          </div>

          {/* CULTURAL STORY */}
          {listing.cultural_story && (
            <div className="bg-maasai-cream dark:bg-maasai-brown/40 rounded-2xl p-5 border-l-4 border-maasai-ochre">
              <h3 className="font-bold text-maasai-black dark:text-white mb-2 flex items-center gap-2">
                <span className="text-xl">🌍</span> Cultural Story
              </h3>
              <p className="text-sm text-maasai-brown/80 dark:text-maasai-beige/80 leading-relaxed italic">{listing.cultural_story}</p>
            </div>
          )}

          {/* DETAILS */}
          <div>
            <h3 className="font-bold text-maasai-black dark:text-white mb-3">Item Details</h3>
            <div className="grid grid-cols-2 gap-2 text-sm">
              {[
                { label: 'Category', value: category?.name as string },
                { label: 'Condition', value: listing.condition || 'New' },
                { label: 'Region', value: listing.region || 'Kenya' },
                { label: 'Listed', value: timeAgo(listing.created_at) },
                { label: 'Stock', value: listing.quantity > 1 ? `${listing.quantity} available` : '1 available' },
                { label: 'Type', value: isAuction ? 'Auction' : 'Fixed Price' },
              ].filter((d) => d.value).map(({ label, value }) => (
                <div key={label} className="flex justify-between py-2 border-b border-maasai-beige/30 dark:border-maasai-brown-light/30">
                  <span className="text-maasai-brown/60 dark:text-maasai-beige/60">{label}</span>
                  <span className="font-medium text-maasai-black dark:text-white">{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* SELLER INFO */}
      <div className="mt-12 grid lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2">
          <h2 className="text-xl font-bold text-maasai-black dark:text-white mb-5">Customer Reviews</h2>
          {reviews.length === 0 ? (
            <div className="text-center py-10 bg-maasai-beige/10 dark:bg-maasai-brown/20 rounded-2xl">
              <Star className="h-10 w-10 mx-auto text-maasai-beige mb-2" />
              <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews.map((review) => {
                const reviewer = review.reviewer as Record<string, unknown>;
                return (
                  <div key={review.id} className="p-4 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                    <div className="flex items-center gap-3 mb-2">
                      <div className="w-9 h-9 rounded-full bg-maasai-gradient flex items-center justify-center text-white font-bold text-sm">
                        {(reviewer?.full_name as string)?.charAt(0) || 'U'}
                      </div>
                      <div>
                        <p className="font-semibold text-sm text-maasai-black dark:text-white">{reviewer?.full_name as string}</p>
                        <div className="flex items-center gap-0.5">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={cn('h-3.5 w-3.5', i < review.rating ? 'text-maasai-gold fill-current' : 'text-maasai-beige')} />
                          ))}
                          <span className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 ml-1">{timeAgo(review.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    {review.comment && <p className="text-sm text-maasai-brown/80 dark:text-maasai-beige/80">{review.comment}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-xl font-bold text-maasai-black dark:text-white mb-5">About the Seller</h2>
          <div className="p-5 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-14 h-14 rounded-full bg-maasai-gradient flex items-center justify-center text-white font-bold text-xl">
                {(seller?.full_name as string)?.charAt(0) || 'S'}
              </div>
              <div>
                <p className="font-bold text-maasai-black dark:text-white">{(seller?.shop_name || seller?.full_name) as string}</p>
                {seller?.is_verified && <VerifiedArtisanBadge />}
              </div>
            </div>
            <div className="space-y-2 text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-4">
              <div className="flex justify-between">
                <span>Rating</span>
                <span className="font-semibold text-maasai-black dark:text-white flex items-center gap-1">
                  <Star className="h-4 w-4 text-maasai-gold fill-current" />
                  {Number(seller?.rating || 0).toFixed(1)}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Total Sales</span>
                <span className="font-semibold text-maasai-black dark:text-white">{(seller?.total_sales as number || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between">
                <span>Member Since</span>
                <span className="font-semibold text-maasai-black dark:text-white">{formatDate(seller?.created_at as string)}</span>
              </div>
            </div>
            <Link href={`/marketplace?seller=${seller?.id}`}>
              <Button variant="outline" size="sm" fullWidth>View All Listings</Button>
            </Link>
            {profile && !isOwner && (
              <Link href={`/messages?to=${seller?.id}`} className="mt-2 block">
                <Button variant="ghost" size="sm" fullWidth>
                  <MessageSquare className="h-4 w-4 mr-2" /> Message Seller
                </Button>
              </Link>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
