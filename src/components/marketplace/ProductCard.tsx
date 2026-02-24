'use client';
import Image from 'next/image';
import Link from 'next/link';
import { Heart, Eye, TrendingUp, ShoppingCart, MapPin, ShieldCheck } from 'lucide-react';
import { Badge } from '@/components/ui/Badge';
import { AuctionTimer } from './AuctionTimer';
import { formatKES, truncate } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Listing } from '@/types';
import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

interface ProductCardProps {
  listing: Listing;
  userId?: string;
  onAddToCart?: (listingId: string) => void;
  className?: string;
}

export function ProductCard({ listing, userId, onAddToCart, className }: ProductCardProps) {
  const [wishlisted, setWishlisted] = useState(false);
  const supabase = createClient();

  const primaryImage = listing.images?.find((img) => img.is_primary)?.image_url
    || listing.images?.[0]?.image_url
    || 'https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=400&h=400&fit=crop';

  const isAuction = listing.listing_type === 'auction';
  const isActive = listing.status === 'active';
  const isSold = listing.status === 'sold';

  async function toggleWishlist(e: React.MouseEvent) {
    e.preventDefault();
    if (!userId) { toast.error('Sign in to save items'); return; }
    setWishlisted((prev) => !prev);
    if (wishlisted) {
      await supabase.from('wishlist_items').delete().eq('user_id', userId).eq('listing_id', listing.id);
    } else {
      await supabase.from('wishlist_items').insert({ user_id: userId, listing_id: listing.id });
      toast.success('Saved to wishlist!');
    }
  }

  return (
    <Link href={`/marketplace/${listing.id}`}>
      <div className={cn(
        'group relative bg-white dark:bg-maasai-brown rounded-2xl overflow-hidden border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1',
        isSold && 'opacity-70', className
      )}>
        <div className="relative aspect-square overflow-hidden bg-maasai-beige/20">
          <Image src={primaryImage} alt={listing.title} fill className="object-cover group-hover:scale-105 transition-transform duration-500" sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw" />
          <div className="absolute top-2 left-2 flex flex-col gap-1">
            {isAuction && <Badge variant="auction">Live Auction</Badge>}
            {!isAuction && <Badge variant="fixed">Buy Now</Badge>}
            {listing.bid_count > 5 && <Badge variant="hot">Hot</Badge>}
            {isSold && <Badge variant="sold">Sold</Badge>}
          </div>
          <button onClick={toggleWishlist} className={cn('absolute top-2 right-2 p-2 rounded-full bg-white/90 shadow-sm transition-all duration-200 hover:scale-110', wishlisted ? 'text-maasai-red' : 'text-maasai-brown/60')}>
            <Heart className={cn('h-4 w-4', wishlisted && 'fill-current')} />
          </button>
          {isAuction && listing.auction_end_time && isActive && (
            <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-maasai-black/80 to-transparent p-3">
              <AuctionTimer endTime={listing.auction_end_time} size="sm" showIcon />
            </div>
          )}
          <div className="absolute bottom-2 right-2 flex items-center gap-1 bg-black/50 rounded-full px-2 py-0.5 text-white text-xs">
            <Eye className="h-3 w-3" />{listing.views}
          </div>
        </div>

        <div className="p-3 space-y-2">
          <h3 className="font-semibold text-maasai-black dark:text-white text-sm leading-tight line-clamp-2">
            {truncate(listing.title, 50)}
          </h3>
          {listing.seller && (
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 truncate">
                {listing.seller.shop_name || listing.seller.full_name}
              </span>
              {listing.seller.is_verified && (
                <ShieldCheck className="h-3.5 w-3.5 text-maasai-red flex-shrink-0" />
              )}
            </div>
          )}
          <div className="flex items-center gap-1 text-xs text-maasai-brown/50 dark:text-maasai-beige/50">
            <MapPin className="h-3 w-3" />{listing.region}
          </div>
          <div className="flex items-center justify-between pt-1">
            <div>
              {isAuction ? (
                <div>
                  <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">{listing.current_bid ? 'Current Bid' : 'Starting Bid'}</p>
                  <p className="font-bold text-maasai-terracotta text-base">{formatKES(listing.current_bid || listing.starting_bid || 0)}</p>
                  <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">{listing.bid_count} bid{listing.bid_count !== 1 ? 's' : ''}</p>
                </div>
              ) : (
                <p className="font-bold text-maasai-black dark:text-white text-base">{formatKES(listing.price || 0)}</p>
              )}
            </div>
            {!isSold && !isAuction && onAddToCart && (
              <button onClick={(e) => { e.preventDefault(); onAddToCart(listing.id); }}
                className="p-2 rounded-lg bg-maasai-red/10 hover:bg-maasai-red text-maasai-red hover:text-white transition-colors" title="Add to cart">
                <ShoppingCart className="h-4 w-4" />
              </button>
            )}
            {isAuction && isActive && (
              <span className="flex items-center gap-1 text-xs font-semibold text-maasai-terracotta">
                <TrendingUp className="h-3.5 w-3.5" />Bid
              </span>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
