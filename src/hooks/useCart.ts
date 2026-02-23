'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import type { CartItem } from '@/types';
import toast from 'react-hot-toast';

export function useCart(userId?: string) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    if (userId) fetchCart();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function fetchCart() {
    setLoading(true);
    const { data } = await supabase
      .from('cart_items')
      .select(`*, listing:listings(id, title, price, listing_type, status, stock_quantity, seller_id, images:listing_images(image_url, is_primary))`)
      .eq('user_id', userId!);
    setItems(data || []);
    setLoading(false);
  }

  async function addToCart(listingId: string, quantity = 1) {
    if (!userId) { toast.error('Please sign in to add items to cart'); return; }
    if (items.find((i) => i.listing_id === listingId)) { toast('Item already in cart', { icon: '🛒' }); return; }
    const { error } = await supabase.from('cart_items').insert({ user_id: userId, listing_id: listingId, quantity });
    if (error) toast.error('Failed to add to cart');
    else { toast.success('Added to cart!'); fetchCart(); }
  }

  async function removeFromCart(itemId: string) {
    const { error } = await supabase.from('cart_items').delete().eq('id', itemId);
    if (!error) { setItems((prev) => prev.filter((i) => i.id !== itemId)); toast.success('Removed from cart'); }
  }

  async function clearCart() {
    if (!userId) return;
    await supabase.from('cart_items').delete().eq('user_id', userId);
    setItems([]);
  }

  const total = items.reduce((sum, item) => sum + (item.listing?.price || 0) * item.quantity, 0);

  return { items, loading, total, addToCart, removeFromCart, clearCart, refetch: fetchCart };
}
