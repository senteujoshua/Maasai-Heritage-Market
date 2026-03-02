'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/Badge';
import { Button } from '@/components/ui/Button';
import { formatKES, timeAgo } from '@/lib/utils';
import { Package, ShoppingBag, Loader2, ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

const STATUS_BADGE: Record<string, 'verified' | 'pending' | 'auction' | 'sold'> = {
  delivered: 'verified',
  confirmed: 'verified',
  pending:   'pending',
  cancelled: 'sold',
  shipped:   'auction',
  processing: 'auction',
};

export default function OrdersPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !profile) { router.push('/login?redirect=/orders'); return; }
    if (profile) fetchOrders();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading]);

  async function fetchOrders() {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('buyer_id', profile!.id)
      .order('created_at', { ascending: false });
    setOrders((data as Order[]) || []);
    setLoading(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-xl mx-auto px-4 py-24 text-center">
        <div className="w-24 h-24 bg-maasai-beige/20 rounded-full flex items-center justify-center mx-auto mb-6">
          <ShoppingBag className="h-10 w-10 text-maasai-beige" />
        </div>
        <h1 className="text-2xl font-bold text-maasai-black dark:text-white mb-2">No orders yet</h1>
        <p className="text-maasai-brown/60 dark:text-maasai-beige/60 mb-8 text-sm">
          Your orders will appear here once you make a purchase.
        </p>
        <Link href="/marketplace">
          <Button variant="primary" size="lg">Browse Marketplace</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white mb-6 flex items-center gap-3">
        <Package className="h-7 w-7 text-maasai-red" /> My Orders
      </h1>

      <div className="space-y-3">
        {orders.map((order) => (
          <Link key={order.id} href={`/orders/${order.id}`}
            className="flex items-center gap-4 p-4 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light hover:border-maasai-red/40 transition-colors group">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="font-mono text-xs text-maasai-brown/60 dark:text-maasai-beige/60">
                  #{order.id.slice(0, 8)}
                </p>
                {order.tracking_code && (
                  <span className="text-xs bg-maasai-beige/20 text-maasai-brown/70 px-1.5 py-0.5 rounded font-mono">
                    {order.tracking_code}
                  </span>
                )}
              </div>
              <p className="font-bold text-maasai-red">{formatKES(order.total)}</p>
              <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 mt-0.5">
                {timeAgo(order.created_at)} · {order.payment_method.toUpperCase()}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={STATUS_BADGE[order.status] || 'pending'} className="text-xs">
                {order.status}
              </Badge>
              <ChevronRight className={cn('h-4 w-4 text-maasai-brown/40 group-hover:text-maasai-red transition-colors')} />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
