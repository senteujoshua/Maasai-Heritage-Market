'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import type { Order } from '@/types';
import toast from 'react-hot-toast';
import {
  Package, QrCode, MapPin, Clock, CheckCircle,
  Truck, RefreshCw, Bell, BarChart2,
} from 'lucide-react';

type OrderStatus = 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';

const STATUS_CONFIG: Record<string, { label: string; color: string; next?: OrderStatus; nextLabel?: string }> = {
  pending:    { label: 'Pending',     color: 'bg-gray-100 text-gray-700',       next: 'confirmed',  nextLabel: 'Confirm'      },
  confirmed:  { label: 'Confirmed',   color: 'bg-blue-100 text-blue-700',       next: 'processing', nextLabel: 'Mark Picked Up' },
  processing: { label: 'Picked Up',   color: 'bg-yellow-100 text-yellow-700',   next: 'shipped',    nextLabel: 'Mark In Transit' },
  shipped:    { label: 'In Transit',  color: 'bg-purple-100 text-purple-700',   next: 'delivered',  nextLabel: 'Mark Delivered'  },
  delivered:  { label: 'Delivered',   color: 'bg-green-100 text-green-700'   },
  cancelled:  { label: 'Cancelled',   color: 'bg-red-100 text-red-700'       },
};

export default function AgentDashboard() {
  const { profile, agentTown, loading: roleLoading } = useUserRole();
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | OrderStatus>('all');
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [notifCount, setNotifCount] = useState(0);

  const supabase = createClient();

  // ── Stats ─────────────────────────────────────────────────────────────────
  const stats = {
    total:     orders.length,
    active:    orders.filter((o) => !['delivered', 'cancelled'].includes(o.status)).length,
    delivered: orders.filter((o) => o.status === 'delivered').length,
    today:     orders.filter((o) => o.assigned_agent_id === profile?.id &&
                 o.delivered_at?.startsWith(new Date().toISOString().split('T')[0])).length,
  };

  // ── Fetch orders ──────────────────────────────────────────────────────────
  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('orders')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) setOrders(data as unknown as Order[]);
    setLoading(false);
  }, [supabase]);

  // ── Realtime subscription ─────────────────────────────────────────────────
  useEffect(() => {
    if (!profile?.id) return;
    fetchOrders();

    const channel = supabase
      .channel('agent-orders')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'orders' },
        (payload) => {
          const updated = payload.new as Order;
          if (payload.eventType === 'UPDATE') {
            setOrders((prev) => prev.map((o) => o.id === updated.id ? updated : o));
          } else if (payload.eventType === 'INSERT') {
            // New order in our town
            toast('📦 New order in ' + (updated.town ?? 'your town'), { icon: '🔔' });
            setNotifCount((n) => n + 1);
            setOrders((prev) => [updated, ...prev]);
          }
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id, fetchOrders, supabase]);

  // ── Update status ─────────────────────────────────────────────────────────
  async function advanceStatus(order: Order) {
    const cfg = STATUS_CONFIG[order.status];
    if (!cfg.next) return;
    setUpdatingId(order.id);

    const updates: Partial<Order> & Record<string, unknown> = { status: cfg.next };
    if (cfg.next === 'processing') updates.picked_up_at  = new Date().toISOString();
    if (cfg.next === 'shipped')    updates.in_transit_at  = new Date().toISOString();
    if (cfg.next === 'delivered')  updates.delivered_at   = new Date().toISOString();

    const { error } = await supabase.from('orders').update(updates).eq('id', order.id);
    if (error) {
      toast.error('Failed to update status');
    } else {
      toast.success(`Order marked as ${cfg.next}`);
      setOrders((prev) =>
        prev.map((o) => o.id === order.id ? { ...o, ...updates } : o)
      );
    }
    setUpdatingId(null);
  }

  // ── Filter orders ─────────────────────────────────────────────────────────
  const filtered = orders.filter((o) => filter === 'all' || o.status === filter);

  // ── Loading ───────────────────────────────────────────────────────────────
  if (roleLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 pb-24">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-4 py-4 sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-white">
              Agent Portal
            </h1>
            <div className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-gray-400">
              <MapPin className="w-3.5 h-3.5" />
              <span>{agentTown ?? 'No town assigned'}</span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            {notifCount > 0 && (
              <button
                onClick={() => setNotifCount(0)}
                className="relative p-2 rounded-full bg-indigo-100 dark:bg-indigo-900/40"
              >
                <Bell className="w-5 h-5 text-indigo-600 dark:text-indigo-400" />
                <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 text-white text-xs rounded-full flex items-center justify-center">
                  {notifCount}
                </span>
              </button>
            )}
            <button onClick={fetchOrders} className="p-2 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800">
              <RefreshCw className="w-5 h-5 text-gray-600 dark:text-gray-400" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
        {/* Stats */}
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Total',     value: stats.total,     icon: Package,      color: 'text-gray-600' },
            { label: 'Active',    value: stats.active,    icon: Truck,        color: 'text-blue-600'  },
            { label: 'Delivered', value: stats.delivered, icon: CheckCircle,  color: 'text-green-600' },
            { label: 'Today',     value: stats.today,     icon: BarChart2,    color: 'text-indigo-600'},
          ].map((s) => {
            const Icon = s.icon;
            return (
              <div key={s.label} className="bg-white dark:bg-gray-900 rounded-xl p-3 shadow-sm border border-gray-200 dark:border-gray-800 text-center">
                <Icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
                <p className="text-xl font-bold text-gray-900 dark:text-white">{s.value}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{s.label}</p>
              </div>
            );
          })}
        </div>

        {/* Quick Actions */}
        <Link
          href="/agent/scan"
          className="flex items-center justify-center gap-2 w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl transition-colors shadow"
        >
          <QrCode className="w-5 h-5" />
          Scan Order Barcode
        </Link>

        {/* Filter */}
        <div className="flex gap-2 overflow-x-auto pb-1">
          {(['all', 'confirmed', 'processing', 'shipped', 'delivered'] as const).map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium whitespace-nowrap transition-colors ${
                filter === f
                  ? 'bg-indigo-600 text-white'
                  : 'bg-white dark:bg-gray-900 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-gray-700'
              }`}
            >
              {f === 'all' ? 'All' : STATUS_CONFIG[f]?.label ?? f}
            </button>
          ))}
        </div>

        {/* Orders list */}
        {loading ? (
          <div className="flex justify-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-12 text-gray-500 dark:text-gray-400">
            <Package className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>No orders found</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((order) => {
              const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending;
              const isUpdating = updatingId === order.id;
              const addr = order.shipping_address as { full_name?: string; address_line1?: string; city?: string } | null;
              const items = Array.isArray(order.items) ? order.items : [];

              return (
                <div
                  key={order.id}
                  className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800"
                >
                  {/* Order header */}
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <span className="font-mono text-xs text-gray-500 dark:text-gray-400">
                        #{order.id.slice(0, 10)}
                      </span>
                      {order.tracking_code && (
                        <span className="ml-2 font-mono text-xs text-indigo-600 dark:text-indigo-400">
                          {order.tracking_code}
                        </span>
                      )}
                    </div>
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${cfg.color}`}>
                      {cfg.label}
                    </span>
                  </div>

                  {/* Items summary */}
                  {items.length > 0 && (
                    <div className="mb-2">
                      {items.map((item, i) => (
                        <p key={i} className="text-sm text-gray-700 dark:text-gray-300">
                          {item.quantity}× {item.title}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Delivery address */}
                  {addr && (
                    <div className="flex items-start gap-1.5 text-sm text-gray-500 dark:text-gray-400 mb-3">
                      <MapPin className="w-4 h-4 mt-0.5 shrink-0" />
                      <span>
                        {addr.full_name} — {addr.address_line1}, {addr.city}
                      </span>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
                      <Clock className="w-3.5 h-3.5" />
                      <span>{new Date(order.created_at).toLocaleDateString()}</span>
                      <span className="font-semibold text-gray-700 dark:text-gray-300">
                        KES {order.total?.toLocaleString()}
                      </span>
                      {order.payment_method === 'cod' && (
                        <span className="bg-orange-100 text-orange-700 dark:bg-orange-900/40 dark:text-orange-300 px-1.5 py-0.5 rounded text-xs">
                          COD
                        </span>
                      )}
                    </div>

                    {cfg.next && (
                      <button
                        onClick={() => advanceStatus(order)}
                        disabled={isUpdating}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white text-xs rounded-lg font-medium transition-colors"
                      >
                        {isUpdating ? (
                          <span className="animate-spin">⏳</span>
                        ) : (
                          <>
                            <CheckCircle className="w-3.5 h-3.5" />
                            {cfg.nextLabel}
                          </>
                        )}
                      </button>
                    )}
                  </div>

                  {/* COD confirmation */}
                  {order.status === 'delivered' && order.payment_method === 'cod' && !order.cash_confirmed_at && (
                    <CODConfirmButton orderId={order.id} onConfirm={() => fetchOrders()} />
                  )}

                  {/* Agent notes */}
                  <AgentNoteField orderId={order.id} existingNote={order.agent_notes} />
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function CODConfirmButton({ orderId, onConfirm }: { orderId: string; onConfirm: () => void }) {
  const [confirming, setConfirming] = useState(false);
  const supabase = createClient();

  async function confirm() {
    setConfirming(true);
    const { error } = await supabase
      .from('orders')
      .update({ cash_confirmed_at: new Date().toISOString() })
      .eq('id', orderId);
    if (error) {
      toast.error('Failed to confirm cash');
    } else {
      toast.success('Cash handover confirmed');
      onConfirm();
    }
    setConfirming(false);
  }

  return (
    <div className="mt-3 p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg flex items-center justify-between">
      <p className="text-sm text-orange-800 dark:text-orange-300">
        Confirm cash received from customer
      </p>
      <button
        onClick={confirm}
        disabled={confirming}
        className="px-3 py-1.5 bg-orange-600 hover:bg-orange-700 text-white text-xs rounded-lg disabled:opacity-60"
      >
        {confirming ? '...' : 'Confirm Cash'}
      </button>
    </div>
  );
}

function AgentNoteField({ orderId, existingNote }: { orderId: string; existingNote: string | null }) {
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState(existingNote ?? '');
  const [saving, setSaving] = useState(false);
  const supabase = createClient();

  async function save() {
    setSaving(true);
    await supabase.from('orders').update({ agent_notes: note }).eq('id', orderId);
    toast.success('Note saved');
    setSaving(false);
    setOpen(false);
  }

  return (
    <div className="mt-2">
      <button onClick={() => setOpen(!open)} className="text-xs text-gray-400 hover:text-indigo-600 transition-colors">
        {existingNote ? '📝 Edit note' : '+ Add note'}
      </button>
      {open && (
        <div className="mt-2 space-y-2">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="w-full text-sm border border-gray-200 dark:border-gray-700 rounded-lg p-2 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            rows={2}
            placeholder="e.g. Customer not home, left at gate..."
          />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving} className="px-2 py-1 bg-indigo-600 text-white text-xs rounded">
              {saving ? '...' : 'Save'}
            </button>
            <button onClick={() => setOpen(false)} className="px-2 py-1 text-xs border border-gray-200 dark:border-gray-700 rounded">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
