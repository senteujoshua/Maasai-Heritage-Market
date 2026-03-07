'use client';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { useNotifications } from '@/hooks/useNotifications';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import {
  Bell, Check, Package, Gavel, ShieldCheck, MessageSquare, AlertTriangle, Loader2,
} from 'lucide-react';
import { timeAgo } from '@/lib/utils';
import { cn } from '@/lib/utils';
import type { Notification } from '@/types';

const ICON_MAP: Record<string, React.ElementType> = {
  bid_placed:         Gavel,
  outbid:             Gavel,
  auction_won:        Gavel,
  auction_ended:      Gavel,
  order_confirmed:    Package,
  order_shipped:      Package,
  order_delivered:    Package,
  order_assigned:     Package,
  order_processing:   Package,
  new_message:        MessageSquare,
  verification_update: ShieldCheck,
  listing_approved:   ShieldCheck,
};

function getNotifHref(n: Notification): string | null {
  const d = n.data || {};
  if (d.listing_id) return `/marketplace/${d.listing_id}`;
  if (d.order_id)   return `/orders/${d.order_id}`;
  return null;
}

function NotificationItem({ n, onRead }: { n: Notification; onRead: () => void }) {
  const Icon = ICON_MAP[n.type] ?? AlertTriangle;
  const href = getNotifHref(n);

  const inner = (
    <div
      onClick={() => { if (!n.is_read) onRead(); }}
      className={cn(
        'flex items-start gap-4 p-4 rounded-xl border transition-colors',
        n.is_read
          ? 'bg-white dark:bg-maasai-brown border-maasai-beige/30 dark:border-maasai-brown-light cursor-default'
          : 'bg-maasai-red/5 dark:bg-maasai-red/10 border-maasai-red/20 dark:border-maasai-red/30 cursor-pointer hover:bg-maasai-red/10',
      )}
    >
      <div className={cn(
        'w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0',
        n.is_read ? 'bg-maasai-beige/30 dark:bg-maasai-brown-light/40' : 'bg-maasai-red/10',
      )}>
        <Icon className={cn('h-5 w-5', n.is_read ? 'text-maasai-brown/60 dark:text-maasai-beige/60' : 'text-maasai-red')} />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn('font-semibold text-sm', n.is_read ? 'text-maasai-brown dark:text-maasai-beige' : 'text-maasai-black dark:text-white')}>
          {n.title}
        </p>
        <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5 leading-relaxed">{n.message}</p>
        <p className="text-xs text-maasai-brown/40 dark:text-maasai-beige/40 mt-1">{timeAgo(n.created_at)}</p>
      </div>
      {!n.is_read && <div className="w-2 h-2 bg-maasai-red rounded-full flex-shrink-0 mt-2" />}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : <div>{inner}</div>;
}

export default function NotificationsPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, loading, markRead, markAllRead } = useNotifications(profile?.id);

  useEffect(() => {
    if (!authLoading && !profile) router.push('/login');
  }, [authLoading, profile, router]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-maasai-red/10 rounded-xl flex items-center justify-center">
            <Bell className="h-5 w-5 text-maasai-red" />
          </div>
          <div>
            <h1 className="text-xl font-bold font-display text-maasai-black dark:text-white">Notifications</h1>
            {unreadCount > 0 && (
              <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">{unreadCount} unread</p>
            )}
          </div>
        </div>
        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            className="flex items-center gap-1.5 text-sm text-maasai-red hover:underline font-medium"
          >
            <Check className="h-4 w-4" /> Mark all read
          </button>
        )}
      </div>

      {notifications.length === 0 ? (
        <div className="text-center py-20 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light">
          <Bell className="h-12 w-12 mx-auto text-maasai-beige mb-3" />
          <p className="font-semibold text-maasai-black dark:text-white mb-1">No notifications yet</p>
          <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">
            Bids, orders, and status updates will appear here
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifications.map((n) => (
            <NotificationItem key={n.id} n={n} onRead={() => markRead(n.id)} />
          ))}
        </div>
      )}
    </div>
  );
}
