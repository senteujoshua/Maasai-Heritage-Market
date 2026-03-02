'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Badge } from '@/components/ui/Badge';
import { formatKES, formatDate } from '@/lib/utils';
import { Package, MapPin, Clock, CheckCircle, Loader2, ChevronLeft, QrCode } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Order } from '@/types';

const STATUS_STEPS = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'] as const;

function StatusStep({ step, current }: { step: string; current: string }) {
  const steps = STATUS_STEPS as readonly string[];
  const stepIdx = steps.indexOf(step);
  const currentIdx = steps.indexOf(current);
  const done = currentIdx >= stepIdx;
  const active = current === step;

  return (
    <div className={cn('flex flex-col items-center gap-1 flex-1')}>
      <div className={cn(
        'w-8 h-8 rounded-full border-2 flex items-center justify-center text-xs font-bold transition-colors',
        done
          ? 'bg-maasai-red border-maasai-red text-white'
          : 'border-maasai-beige dark:border-maasai-brown-light text-maasai-brown/40',
      )}>
        {done ? <CheckCircle className="h-4 w-4" /> : stepIdx + 1}
      </div>
      <span className={cn(
        'text-[10px] font-medium capitalize text-center',
        active ? 'text-maasai-red' : done ? 'text-maasai-brown/70 dark:text-maasai-beige/70' : 'text-maasai-brown/40',
      )}>
        {step}
      </span>
    </div>
  );
}

export default function OrderDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, loading: authLoading } = useAuth();
  const [order, setOrder] = useState<Order | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !profile) { router.push('/login'); return; }
    if (profile) fetchOrder();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading]);

  async function fetchOrder() {
    const supabase = createClient();
    const { data } = await supabase
      .from('orders')
      .select('*')
      .eq('id', id)
      .eq('buyer_id', profile!.id)
      .single();
    setOrder(data as Order);
    setLoading(false);
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <Package className="h-16 w-16 mx-auto text-maasai-beige mb-4" />
        <h2 className="text-xl font-bold text-maasai-black dark:text-white">Order not found</h2>
        <Link href="/orders" className="text-maasai-red mt-4 inline-block hover:underline">
          Back to Orders
        </Link>
      </div>
    );
  }

  const address = order.shipping_address;
  const isCancelled = order.status === 'cancelled';

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <Link href="/orders" className="p-2 rounded-lg hover:bg-maasai-beige/20 text-maasai-brown/60 hover:text-maasai-red transition-colors">
          <ChevronLeft className="h-5 w-5" />
        </Link>
        <div>
          <h1 className="text-xl font-bold font-display text-maasai-black dark:text-white">
            Order #{order.id.slice(0, 8)}
          </h1>
          <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50">{formatDate(order.created_at)}</p>
        </div>
      </div>

      {/* Status tracker */}
      {!isCancelled && (
        <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-5 mb-4">
          <h2 className="font-bold text-maasai-black dark:text-white mb-4 text-sm">Order Progress</h2>
          <div className="flex items-start gap-0">
            {STATUS_STEPS.map((step, i) => (
              <div key={step} className="flex items-center flex-1">
                <StatusStep step={step} current={order.status} />
                {i < STATUS_STEPS.length - 1 && (
                  <div className={cn(
                    'flex-1 h-0.5 mb-4',
                    STATUS_STEPS.indexOf(order.status as typeof STATUS_STEPS[number]) > i
                      ? 'bg-maasai-red'
                      : 'bg-maasai-beige dark:bg-maasai-brown-light'
                  )} />
                )}
              </div>
            ))}
          </div>
          {order.tracking_code && (
            <div className="mt-4 flex items-center gap-2 text-xs text-maasai-brown/60 dark:text-maasai-beige/60 bg-maasai-beige/10 rounded-lg p-3">
              <QrCode className="h-4 w-4 flex-shrink-0" />
              <span>Tracking: <span className="font-mono font-bold text-maasai-black dark:text-white">{order.tracking_code}</span></span>
            </div>
          )}
        </div>
      )}

      {/* Payment summary */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-5 mb-4 space-y-3">
        <h2 className="font-bold text-maasai-black dark:text-white text-sm">Payment</h2>
        <div className="flex justify-between text-sm text-maasai-brown/70 dark:text-maasai-beige/70">
          <span>Subtotal</span><span>{formatKES(order.subtotal)}</span>
        </div>
        <div className="flex justify-between text-sm text-maasai-brown/70 dark:text-maasai-beige/70">
          <span>Delivery</span>
          <span className={order.delivery_fee === 0 ? 'text-green-600 font-semibold' : ''}>
            {order.delivery_fee === 0 ? 'FREE' : formatKES(order.delivery_fee)}
          </span>
        </div>
        <div className="flex justify-between font-bold border-t border-maasai-beige/30 dark:border-maasai-brown-light pt-3">
          <span className="text-maasai-black dark:text-white">Total</span>
          <span className="text-maasai-red">{formatKES(order.total)}</span>
        </div>
        <div className="flex items-center justify-between text-xs text-maasai-brown/50">
          <span>Method: {order.payment_method.toUpperCase()}</span>
          <Badge variant={order.payment_status === 'paid' ? 'verified' : 'pending'} className="text-xs">
            {order.payment_status}
          </Badge>
        </div>
        {order.mpesa_receipt_number && (
          <p className="text-xs text-maasai-brown/50 font-mono">
            M-Pesa: {order.mpesa_receipt_number}
          </p>
        )}
      </div>

      {/* Shipping address */}
      {address && (
        <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-5 mb-4">
          <h2 className="font-bold text-maasai-black dark:text-white text-sm mb-3 flex items-center gap-1.5">
            <MapPin className="h-4 w-4 text-maasai-red" /> Delivery Address
          </h2>
          <p className="text-sm text-maasai-brown dark:text-maasai-beige font-semibold">{address.full_name}</p>
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70">{address.phone}</p>
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70">{address.address_line1}</p>
          {address.address_line2 && <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70">{address.address_line2}</p>}
          <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70">{address.city}, {address.county}</p>
        </div>
      )}

      {/* Timestamps */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-5">
        <h2 className="font-bold text-maasai-black dark:text-white text-sm mb-3 flex items-center gap-1.5">
          <Clock className="h-4 w-4 text-maasai-red" /> Timeline
        </h2>
        <div className="space-y-1.5 text-xs text-maasai-brown/60 dark:text-maasai-beige/60">
          <div className="flex justify-between">
            <span>Order placed</span>
            <span>{formatDate(order.created_at)}</span>
          </div>
          {order.paid_at && (
            <div className="flex justify-between">
              <span>Payment confirmed</span>
              <span>{formatDate(order.paid_at)}</span>
            </div>
          )}
          {order.picked_up_at && (
            <div className="flex justify-between">
              <span>Picked up</span>
              <span>{formatDate(order.picked_up_at)}</span>
            </div>
          )}
          {order.in_transit_at && (
            <div className="flex justify-between">
              <span>In transit</span>
              <span>{formatDate(order.in_transit_at)}</span>
            </div>
          )}
          {order.delivered_at && (
            <div className="flex justify-between">
              <span>Delivered</span>
              <span>{formatDate(order.delivered_at)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
