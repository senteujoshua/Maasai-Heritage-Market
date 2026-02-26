'use client';

import { useEffect, useState, useCallback } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useUserRole } from '@/hooks/useUserRole';
import { KENYAN_TOWNS } from '@/types';
import type { Profile, Order, Dispute } from '@/types';
import toast from 'react-hot-toast';
import {
  Users, Package, AlertTriangle, CheckCircle, XCircle,
  ClipboardList, BarChart2, UserCheck, RefreshCw, MapPin,
} from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

type Tab = 'overview' | 'listings' | 'verifications' | 'orders' | 'agents' | 'disputes';

interface PendingListing {
  id: string;
  title: string;
  status: string;
  region: string;
  created_at: string;
  seller: { full_name: string; shop_name: string | null; is_verified: boolean };
}

interface Stats {
  pendingListings: number;
  pendingVerifications: number;
  openDisputes: number;
  totalOrders: number;
  deliveredToday: number;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function Badge({
  children, color = 'gray',
}: { children: React.ReactNode; color?: 'gray' | 'yellow' | 'green' | 'red' | 'blue' }) {
  const map = {
    gray:   'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300',
    green:  'bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300',
    red:    'bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300',
    blue:   'bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${map[color]}`}>
      {children}
    </span>
  );
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function ManagerDashboard() {
  const { profile, loading: roleLoading } = useUserRole();
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [stats, setStats] = useState<Stats | null>(null);
  const [listings, setListings] = useState<PendingListing[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [agents, setAgents] = useState<Profile[]>([]);
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [verifications, setVerifications] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [rejectReason, setRejectReason] = useState('');
  const [rejectTarget, setRejectTarget] = useState<string | null>(null);
  const [assigningOrder, setAssigningOrder] = useState<string | null>(null);

  const supabase = createClient();

  // ── Data fetching ──────────────────────────────────────────────────────────

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [listingsRes, verificationsRes, ordersRes, agentsRes, disputesRes] = await Promise.all([
        supabase
          .from('listings')
          .select('id, title, status, region, created_at, seller:profiles!seller_id(full_name, shop_name, is_verified)')
          .eq('status', 'pending_approval')
          .order('created_at', { ascending: false })
          .limit(50),

        supabase
          .from('profiles')
          .select('*')
          .eq('verification_status', 'pending')
          .order('created_at', { ascending: false }),

        supabase
          .from('orders')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100),

        supabase
          .from('profiles')
          .select('*')
          .eq('role', 'agent')
          .order('full_name'),

        supabase
          .from('disputes')
          .select('*, order:orders(*), raiser:profiles!raised_by(*)')
          .order('created_at', { ascending: false })
          .limit(50),
      ]);

      setListings((listingsRes.data as unknown as PendingListing[]) ?? []);
      setVerifications((verificationsRes.data as Profile[]) ?? []);
      setOrders((ordersRes.data as unknown as Order[]) ?? []);
      setAgents((agentsRes.data as Profile[]) ?? []);
      setDisputes((disputesRes.data as unknown as Dispute[]) ?? []);

      const today = new Date().toISOString().split('T')[0];
      setStats({
        pendingListings:      listingsRes.data?.length ?? 0,
        pendingVerifications: verificationsRes.data?.length ?? 0,
        openDisputes:         disputesRes.data?.filter((d) => d.status === 'open').length ?? 0,
        totalOrders:          ordersRes.data?.length ?? 0,
        deliveredToday:       ordersRes.data?.filter(
          (o) => o.delivered_at?.startsWith(today)
        ).length ?? 0,
      });
    } finally {
      setLoading(false);
    }
  }, [supabase]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // ── Actions ────────────────────────────────────────────────────────────────

  async function approveListing(id: string) {
    const { error } = await supabase
      .from('listings')
      .update({ status: 'active', is_approved: true })
      .eq('id', id);
    if (error) { toast.error('Failed to approve'); return; }
    toast.success('Listing approved');
    setListings((prev) => prev.filter((l) => l.id !== id));
    setStats((s) => s ? { ...s, pendingListings: s.pendingListings - 1 } : s);
  }

  async function rejectListing(id: string) {
    if (!rejectReason.trim()) { toast.error('Please provide a reason'); return; }
    const { error } = await supabase
      .from('listings')
      .update({ status: 'rejected', is_approved: false, rejection_reason: rejectReason })
      .eq('id', id);
    if (error) { toast.error('Failed to reject'); return; }
    toast.success('Listing rejected');
    setListings((prev) => prev.filter((l) => l.id !== id));
    setStats((s) => s ? { ...s, pendingListings: s.pendingListings - 1 } : s);
    setRejectTarget(null);
    setRejectReason('');
  }

  async function approveVerification(userId: string) {
    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: 'approved', is_verified: true })
      .eq('id', userId);
    if (error) { toast.error('Failed to approve'); return; }
    toast.success('Verification approved');
    setVerifications((prev) => prev.filter((v) => v.id !== userId));
    setStats((s) => s ? { ...s, pendingVerifications: s.pendingVerifications - 1 } : s);
  }

  async function rejectVerification(userId: string) {
    if (!rejectReason.trim()) { toast.error('Please provide a reason'); return; }
    const { error } = await supabase
      .from('profiles')
      .update({ verification_status: 'rejected', is_verified: false, rejection_reason: rejectReason })
      .eq('id', userId);
    if (error) { toast.error('Failed to reject'); return; }
    toast.success('Verification rejected');
    setVerifications((prev) => prev.filter((v) => v.id !== userId));
    setStats((s) => s ? { ...s, pendingVerifications: s.pendingVerifications - 1 } : s);
    setRejectTarget(null);
    setRejectReason('');
  }

  async function assignAgent(orderId: string, agentId: string) {
    const { error } = await supabase.rpc('assign_agent_to_order', {
      p_order_id: orderId,
      p_agent_id: agentId,
    });
    if (error) { toast.error(error.message); return; }
    toast.success('Agent assigned successfully');
    setAssigningOrder(null);
    fetchAll();
  }

  async function resolveDispute(disputeId: string, resolution: string) {
    const { error } = await supabase
      .from('disputes')
      .update({ status: 'resolved', resolution, assigned_to: profile?.id })
      .eq('id', disputeId);
    if (error) { toast.error('Failed to resolve dispute'); return; }
    toast.success('Dispute resolved');
    fetchAll();
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  if (roleLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-indigo-600" />
      </div>
    );
  }

  const TABS: { id: Tab; label: string; icon: React.ElementType; count?: number }[] = [
    { id: 'overview',      label: 'Overview',      icon: BarChart2 },
    { id: 'listings',      label: 'Listings',       icon: ClipboardList, count: stats?.pendingListings },
    { id: 'verifications', label: 'Verifications',  icon: UserCheck,     count: stats?.pendingVerifications },
    { id: 'orders',        label: 'Orders',         icon: Package },
    { id: 'agents',        label: 'Agents',         icon: MapPin },
    { id: 'disputes',      label: 'Disputes',       icon: AlertTriangle, count: stats?.openDisputes },
  ];

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900 dark:text-white">Manager Dashboard</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400">
              Welcome, {profile?.full_name} — Operations Control
            </p>
          </div>
          <button
            onClick={fetchAll}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-indigo-600 transition-colors"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Tabs */}
        <nav className="flex gap-1 mb-6 overflow-x-auto pb-1">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                  activeTab === tab.id
                    ? 'bg-indigo-600 text-white'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
                {tab.count !== undefined && tab.count > 0 && (
                  <span className="ml-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                    {tab.count > 9 ? '9+' : tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* ── Overview ─────────────────────────────────────────────────────── */}
        {activeTab === 'overview' && stats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { label: 'Pending Listings',      value: stats.pendingListings,      icon: ClipboardList, color: 'yellow' },
              { label: 'Pending Verifications', value: stats.pendingVerifications, icon: UserCheck,     color: 'orange' },
              { label: 'Open Disputes',         value: stats.openDisputes,         icon: AlertTriangle, color: 'red'    },
              { label: 'Total Orders',          value: stats.totalOrders,          icon: Package,       color: 'blue'   },
              { label: 'Delivered Today',       value: stats.deliveredToday,       icon: CheckCircle,   color: 'green'  },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <div key={item.label} className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className="w-4 h-4 text-gray-400" />
                    <span className="text-xs text-gray-500 dark:text-gray-400">{item.label}</span>
                  </div>
                  <p className="text-2xl font-bold text-gray-900 dark:text-white">{item.value}</p>
                </div>
              );
            })}
          </div>
        )}

        {/* ── Pending Listings ─────────────────────────────────────────────── */}
        {activeTab === 'listings' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Pending Listings ({listings.length})
            </h2>
            {listings.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No pending listings</p>
            )}
            {listings.map((listing) => (
              <div
                key={listing.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800"
              >
                {rejectTarget === listing.id ? (
                  <div className="space-y-3">
                    <p className="font-medium text-gray-900 dark:text-white">Reject: {listing.title}</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => rejectListing(listing.id)} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                        Confirm Reject
                      </button>
                      <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{listing.title}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">
                        by {listing.seller?.shop_name ?? listing.seller?.full_name} · {listing.region}
                        {listing.seller?.is_verified && (
                          <span className="ml-2 text-green-600 text-xs">✓ Verified Seller</span>
                        )}
                      </p>
                      <p className="text-xs text-gray-400 mt-1">
                        {new Date(listing.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveListing(listing.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget(listing.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Verifications ─────────────────────────────────────────────────── */}
        {activeTab === 'verifications' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">
              Pending Verifications ({verifications.length})
            </h2>
            {verifications.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No pending verifications</p>
            )}
            {verifications.map((v) => (
              <div
                key={v.id}
                className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800"
              >
                {rejectTarget === v.id ? (
                  <div className="space-y-3">
                    <p className="font-medium text-gray-900 dark:text-white">Reject: {v.full_name}</p>
                    <textarea
                      value={rejectReason}
                      onChange={(e) => setRejectReason(e.target.value)}
                      placeholder="Reason for rejection..."
                      className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      rows={3}
                    />
                    <div className="flex gap-2">
                      <button onClick={() => rejectVerification(v.id)} className="px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700">
                        Confirm Reject
                      </button>
                      <button onClick={() => { setRejectTarget(null); setRejectReason(''); }} className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-sm rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800">
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between flex-wrap gap-3">
                    <div>
                      <p className="font-medium text-gray-900 dark:text-white">{v.full_name}</p>
                      <p className="text-sm text-gray-500 dark:text-gray-400">{v.email} · {v.shop_name}</p>
                      <div className="flex gap-2 mt-2">
                        {v.national_id_url && (
                          <a href={v.national_id_url} target="_blank" rel="noreferrer"
                            className="text-xs text-indigo-600 hover:underline">
                            View National ID
                          </a>
                        )}
                        {v.kra_pin_url && (
                          <a href={v.kra_pin_url} target="_blank" rel="noreferrer"
                            className="text-xs text-indigo-600 hover:underline">
                            View KRA PIN
                          </a>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => approveVerification(v.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
                      >
                        <CheckCircle className="w-4 h-4" /> Approve
                      </button>
                      <button
                        onClick={() => setRejectTarget(v.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white text-sm rounded-lg hover:bg-red-700"
                      >
                        <XCircle className="w-4 h-4" /> Reject
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── Orders + Agent Assignment ─────────────────────────────────────── */}
        {activeTab === 'orders' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">All Orders ({orders.length})</h2>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 border-b border-gray-200 dark:border-gray-800">
                    <th className="py-2 pr-4">Order ID</th>
                    <th className="py-2 pr-4">Tracking</th>
                    <th className="py-2 pr-4">Town</th>
                    <th className="py-2 pr-4">Total</th>
                    <th className="py-2 pr-4">Status</th>
                    <th className="py-2 pr-4">Agent</th>
                    <th className="py-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const assignedAgent = agents.find((a) => a.id === order.assigned_agent_id);
                    return (
                      <tr key={order.id} className="border-b border-gray-100 dark:border-gray-800 hover:bg-gray-50 dark:hover:bg-gray-900/50">
                        <td className="py-2 pr-4 font-mono text-xs text-gray-600 dark:text-gray-400">
                          {order.id.slice(0, 8)}…
                        </td>
                        <td className="py-2 pr-4 font-mono text-xs">{order.tracking_code ?? '—'}</td>
                        <td className="py-2 pr-4">{order.town ?? '—'}</td>
                        <td className="py-2 pr-4">KES {order.total?.toLocaleString()}</td>
                        <td className="py-2 pr-4">
                          <Badge color={
                            order.status === 'delivered' ? 'green' :
                            order.status === 'shipped'   ? 'blue'  :
                            order.status === 'cancelled' ? 'red'   : 'yellow'
                          }>
                            {order.status}
                          </Badge>
                        </td>
                        <td className="py-2 pr-4 text-xs">
                          {assignedAgent ? assignedAgent.full_name : (
                            <span className="text-gray-400">Unassigned</span>
                          )}
                        </td>
                        <td className="py-2">
                          {assigningOrder === order.id ? (
                            <div className="flex items-center gap-2">
                              <select
                                className="text-xs border border-gray-300 dark:border-gray-700 rounded px-2 py-1 dark:bg-gray-800 dark:text-white"
                                defaultValue=""
                                onChange={(e) => e.target.value && assignAgent(order.id, e.target.value)}
                              >
                                <option value="" disabled>Pick agent…</option>
                                {agents
                                  .filter((a) => !order.town || a.town === order.town)
                                  .map((a) => (
                                    <option key={a.id} value={a.id}>
                                      {a.full_name} ({a.town ?? 'no town'})
                                    </option>
                                  ))}
                              </select>
                              <button onClick={() => setAssigningOrder(null)} className="text-xs text-gray-500 hover:text-gray-700">✕</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setAssigningOrder(order.id)}
                              className="text-xs text-indigo-600 hover:underline"
                            >
                              {assignedAgent ? 'Reassign' : 'Assign Agent'}
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Agents ────────────────────────────────────────────────────────── */}
        {activeTab === 'agents' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Field Agents ({agents.length})</h2>
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {agents.map((agent) => {
                const agentOrders = orders.filter((o) => o.assigned_agent_id === agent.id);
                const delivered   = agentOrders.filter((o) => o.status === 'delivered').length;
                return (
                  <div key={agent.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="w-10 h-10 rounded-full bg-indigo-100 dark:bg-indigo-900/40 flex items-center justify-center text-indigo-700 dark:text-indigo-300 font-bold text-sm">
                        {agent.full_name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white text-sm">{agent.full_name}</p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">{agent.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 text-xs text-gray-500 dark:text-gray-400 mb-2">
                      <MapPin className="w-3.5 h-3.5" />
                      <span>{agent.town ?? 'No town assigned'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-center text-xs">
                      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-2">
                        <p className="font-bold text-gray-900 dark:text-white text-lg">{agentOrders.length}</p>
                        <p className="text-gray-500 dark:text-gray-400">Assigned</p>
                      </div>
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-lg p-2">
                        <p className="font-bold text-green-700 dark:text-green-400 text-lg">{delivered}</p>
                        <p className="text-gray-500 dark:text-gray-400">Delivered</p>
                      </div>
                    </div>
                  </div>
                );
              })}
              {agents.length === 0 && (
                <p className="text-gray-500 dark:text-gray-400 col-span-3 py-8 text-center">
                  No agents found. Assign the Agent role to users in the CEO Admin panel.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ── Disputes ──────────────────────────────────────────────────────── */}
        {activeTab === 'disputes' && (
          <div className="space-y-3">
            <h2 className="font-semibold text-gray-900 dark:text-white">Disputes ({disputes.length})</h2>
            {disputes.length === 0 && (
              <p className="text-gray-500 dark:text-gray-400 py-8 text-center">No disputes found</p>
            )}
            {disputes.map((d) => (
              <div key={d.id} className="bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm border border-gray-200 dark:border-gray-800">
                <div className="flex items-start justify-between flex-wrap gap-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <Badge color={
                        d.status === 'open'          ? 'red'    :
                        d.status === 'investigating' ? 'yellow' :
                        d.status === 'resolved'      ? 'green'  : 'gray'
                      }>
                        {d.status}
                      </Badge>
                      <span className="text-xs text-gray-500 dark:text-gray-400">
                        Order: {d.order_id.slice(0, 8)}…
                      </span>
                    </div>
                    <p className="font-medium text-gray-900 dark:text-white">{d.reason}</p>
                    {d.details && <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">{d.details}</p>}
                    <p className="text-xs text-gray-400 mt-1">
                      Raised by {(d.raiser as unknown as Profile)?.full_name} · {new Date(d.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  {d.status !== 'resolved' && d.status !== 'closed' && (
                    <DisputeResolver
                      onResolve={(resolution) => resolveDispute(d.id, resolution)}
                    />
                  )}
                </div>
                {d.resolution && (
                  <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/20 rounded-lg text-sm text-green-800 dark:text-green-300">
                    <strong>Resolution:</strong> {d.resolution}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Reject modal backdrop */}
      {rejectTarget && (
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={() => { setRejectTarget(null); setRejectReason(''); }}
        />
      )}
    </div>
  );
}

// ── Inline dispute resolver ────────────────────────────────────────────────────

function DisputeResolver({ onResolve }: { onResolve: (resolution: string) => void }) {
  const [open, setOpen] = useState(false);
  const [resolution, setResolution] = useState('');

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="text-sm text-indigo-600 hover:underline">
        Resolve
      </button>
    );
  }

  return (
    <div className="w-full mt-3 space-y-2">
      <textarea
        value={resolution}
        onChange={(e) => setResolution(e.target.value)}
        placeholder="Describe resolution…"
        className="w-full border border-gray-300 dark:border-gray-700 rounded-lg p-2 text-sm dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
        rows={3}
      />
      <div className="flex gap-2">
        <button
          onClick={() => { onResolve(resolution); setOpen(false); }}
          className="px-3 py-1.5 bg-green-600 text-white text-sm rounded-lg hover:bg-green-700"
        >
          Submit Resolution
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-700 text-sm rounded-lg"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
