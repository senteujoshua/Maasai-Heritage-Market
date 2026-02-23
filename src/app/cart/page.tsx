'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/Button';
import { formatKES } from '@/lib/utils';
import { ShoppingCart, Trash2, Plus, Minus, ArrowRight, Package, ShieldCheck } from 'lucide-react';
import type { CartItem } from '@/types';

export default function CartPage() {
  const { profile, loading: authLoading } = useAuth();
  const { items, total, loading, removeFromCart, updateQuantity } = useCart(profile?.id);
  const router = useRouter();

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login?redirect=/cart');
  }, [profile, authLoading, router]);

  const commission = total * 0.09;
  const delivery = total > 5000 ? 0 : 350;
  const grandTotal = total + delivery;

  if (authLoading || loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center">
        <div className="animate-pulse space-y-4">
          {[1, 2, 3].map((i) => <div key={i} className="h-24 bg-maasai-beige/20 rounded-xl" />)}
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-24 h-24 bg-maasai-beige/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingCart className="h-10 w-10 text-maasai-beige" />
        </div>
        <h1 className="text-2xl font-bold text-maasai-black dark:text-white mb-2">Your cart is empty</h1>
        <p className="text-maasai-brown/60 dark:text-maasai-beige/60 mb-8 text-sm">Discover authentic Kenyan cultural pieces and add them to your cart.</p>
        <Link href="/marketplace">
          <Button variant="primary" size="lg">Explore Marketplace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white mb-6 flex items-center gap-3">
        <ShoppingCart className="h-7 w-7 text-maasai-red" />
        Shopping Cart
        <span className="text-base font-normal text-maasai-brown/60 dark:text-maasai-beige/60">({items.length} item{items.length !== 1 ? 's' : ''})</span>
      </h1>

      <div className="grid lg:grid-cols-3 gap-8">
        {/* ITEMS */}
        <div className="lg:col-span-2 space-y-3">
          {items.map((item: CartItem) => {
            const listing = item.listing as Record<string, unknown>;
            const images = (listing?.images as Array<{image_url: string; is_primary: boolean}>) || [];
            const primaryImage = images.find((i) => i.is_primary)?.image_url || images[0]?.image_url;
            const price = listing?.price as number || 0;

            return (
              <div key={item.id} className="flex gap-4 p-4 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-maasai-beige/20">
                  {primaryImage ? (
                    <Image src={primaryImage} alt={listing?.title as string} width={80} height={80} className="object-cover w-full h-full" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-8 w-8 text-maasai-beige" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <Link href={`/marketplace/${listing?.id}`} className="font-semibold text-maasai-black dark:text-white hover:text-maasai-red transition-colors line-clamp-2 text-sm">
                    {listing?.title as string}
                  </Link>
                  <p className="text-maasai-red font-bold mt-1">{formatKES(price)}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center border border-maasai-beige dark:border-maasai-brown-light rounded-lg overflow-hidden">
                      <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}
                        className="px-2.5 py-1 hover:bg-maasai-beige/30 transition-colors">
                        <Minus className="h-3.5 w-3.5" />
                      </button>
                      <span className="px-3 py-1 text-sm font-semibold text-maasai-black dark:text-white border-x border-maasai-beige dark:border-maasai-brown-light">{item.quantity}</span>
                      <button onClick={() => updateQuantity(item.id, item.quantity + 1)}
                        className="px-2.5 py-1 hover:bg-maasai-beige/30 transition-colors">
                        <Plus className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    <span className="text-sm font-bold text-maasai-black dark:text-white">{formatKES(price * item.quantity)}</span>
                    <button onClick={() => removeFromCart(item.id)} className="ml-auto text-maasai-brown/40 hover:text-maasai-red transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* ORDER SUMMARY */}
        <div className="lg:col-span-1">
          <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-5 sticky top-24">
            <h2 className="font-bold text-maasai-black dark:text-white mb-4 text-lg">Order Summary</h2>
            <div className="space-y-2 text-sm mb-4">
              <div className="flex justify-between text-maasai-brown/70 dark:text-maasai-beige/70">
                <span>Subtotal</span>
                <span>{formatKES(total)}</span>
              </div>
              <div className="flex justify-between text-maasai-brown/70 dark:text-maasai-beige/70">
                <span>Delivery</span>
                <span className={delivery === 0 ? 'text-green-600 font-semibold' : ''}>{delivery === 0 ? 'FREE' : formatKES(delivery)}</span>
              </div>
              {delivery > 0 && (
                <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50">Free delivery on orders above {formatKES(5000)}</p>
              )}
            </div>
            <div className="border-t border-maasai-beige/30 dark:border-maasai-brown-light pt-3 mb-5">
              <div className="flex justify-between font-bold text-maasai-black dark:text-white text-lg">
                <span>Total</span>
                <span className="text-maasai-red">{formatKES(grandTotal)}</span>
              </div>
            </div>
            <Link href="/checkout">
              <Button variant="primary" size="lg" fullWidth>
                Proceed to Checkout <ArrowRight className="h-4 w-4 ml-2" />
              </Button>
            </Link>
            <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-maasai-brown/50 dark:text-maasai-beige/50">
              <ShieldCheck className="h-3.5 w-3.5" /> Secured by M-Pesa & SSL
            </div>
            <div className="mt-3 text-center">
              <Link href="/marketplace" className="text-xs text-maasai-red hover:underline">Continue Shopping</Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
