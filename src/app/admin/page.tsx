'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge, VerifiedArtisanBadge } from '@/components/ui/Badge';
import { formatKES, timeAgo, formatDate } from '@/lib/utils';
import {
  ShieldCheck, Package, Users, CheckCircle, XCircle, Eye,
  Loader2, TrendingUp, AlertTriangle, DollarSign, Clock,
  BarChart2, Gavel, Tag, Search, ShoppingBag, RefreshCw,
  ChevronDown, UserCog, X,
} from 'lucide-react';
import { ROLE_LABELS } from '@/types';
import type { UserRole } from '@/types';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

/* ─── Types ─────────────────────────────────────────────────────────────── */
interface PendingListing {
  id: string; title: string; price: number | null; listing_type: string; created_at: string;
  seller: { full_name: string; shop_name: string | null; is_verified: boolean } | null;
  images: Array<{ image_url: string; is_primary: boolean }>;
  category: { name: string } | null;
}

interface PendingVerification {
  id: string; full_name: string; email: string; phone: string | null;
  national_id_url: string | null; kra_pin_url: string | null; created_at: string;
  shop_name: string | null;
}

interface UserRow {
  id: string; full_name: string; email: string; role: string;
  is_verified: boolean; verification_status: string; created_at: string;
  total_sales: number; rating: number; shop_name: string | null;
  town: string | null;
}

interface OrderRow {
  id: string; total: number; payment_status: string; order_status: string;
  created_at: string; payment_method: string;
  buyer: { full_name: string; email: string } | null;
  listing: { title: string } | null;
}

interface PlatformStats {
  totalUsers: number; totalListings: number; totalOrders: number;
  totalRevenue: number; pendingListings: number; pendingVerifications: number;
  platformEarnings: number;
}

/* ─── Tab definitions ────────────────────────────────────────────────────── */
const TABS = [
  { id: 'overview',       label: 'Overview',      Icon: BarChart2   },
  { id: 'listings',       label: 'Listings',      Icon: Package     },
  { id: 'verifications',  label: 'Verifications', Icon: ShieldCheck },
  { id: 'orders',         label: 'Orders',        Icon: ShoppingBag },
  { id: 'users',          label: 'Users',         Icon: Users       },
] as const;
type TabId = typeof TABS[number]['id'];

/* ─── Reject Modal ───────────────────────────────────────────────────────── */
function RejectModal({ title, onConfirm, onCancel }: {
  title: string;
  onConfirm: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');
  const inputRef = useRef<HTMLTextAreaElement>(null);
  useEffect(() => { inputRef.current?.focus(); }, []);
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onCancel} />
      <div className="relative bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-maasai-black dark:text-white">Reject — {title}</h3>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-maasai-beige/20 text-maasai-beige hover:text-maasai-black transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div>
          <label className="block text-xs font-semibold text-maasai-beige uppercase tracking-wider mb-1.5">Rejection reason <span className="text-maasai-red">*</span></label>
          <textarea
            ref={inputRef}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Explain why this is being rejected…"
            className="w-full px-4 py-3 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red resize-none placeholder:text-maasai-beige"
          />
        </div>
        <div className="flex gap-3 pt-1">
          <Button variant="outline" size="md" onClick={onCancel} className="flex-1">Cancel</Button>
          <Button
            variant="danger" size="md" onClick={() => { if (reason.trim()) onConfirm(reason.trim()); }}
            disabled={!reason.trim()} className="flex-1"
          >
            <XCircle className="h-4 w-4" /> Confirm Reject
          </Button>
        </div>
      </div>
    </div>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────────────── */
export default function AdminDashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();

  const [activeTab, setActiveTab]                 = useState<TabId>('overview');
  const [pendingListings, setPendingListings]       = useState<PendingListing[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerification[]>([]);
  const [stats, setStats]                         = useState<PlatformStats>({ totalUsers: 0, totalListings: 0, totalOrders: 0, totalRevenue: 0, pendingListings: 0, pendingVerifications: 0, platformEarnings: 0 });
  const [loading, setLoading]                     = useState(true);
  const [refreshing, setRefreshing]               = useState(false);
  const [fetchError, setFetchError]               = useState<string | null>(null);
  const [lastSynced, setLastSynced]               = useState<Date | null>(null);

  // Reject modal state
  const [rejectTarget, setRejectTarget] = useState<{ id: string; name: string; type: 'listing' | 'verification' } | null>(null);

  // ── Auth guard + initial load ──────────────────────────────────────────
  useEffect(() => {
    const allowed = ['admin', 'ceo'];
    if (!authLoading && (!profile || !allowed.includes(profile.role))) { router.push('/'); return; }
    if (profile && allowed.includes(profile.role)) fetchAdminData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile, authLoading]);

  // ── Real-time subscriptions for listings + verifications ───────────────
  useEffect(() => {
    if (!profile || !['admin', 'ceo'].includes(profile.role)) return;
    const supabase = createClient();
    const channel = supabase
      .channel('admin-main-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'listings' }, () => {
        fetchAdminData(true);
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'profiles' }, () => {
        // New user registered — refresh stats so totalUsers stays accurate
        fetchAdminData(true);
      })
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'profiles', filter: 'verification_status=eq.pending' }, () => {
        // A seller submitted for verification
        fetchAdminData(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile?.id, profile?.role]);

  async function fetchAdminData(silent = false) {
    if (!silent) setLoading(true); else setRefreshing(true);
    setFetchError(null);
    const supabase = createClient();

    // All three calls use SECURITY DEFINER RPCs — bypasses RLS entirely,
    // fixes the 'order_status' column bug, the invalid listing FK join,
    // and the 'paid' vs 'completed' payment_status mismatch.
    const [statsRes, listingsRes, verificationsRes] = await Promise.all([
      supabase.rpc('get_admin_stats'),
      supabase.rpc('get_pending_listings_admin'),
      supabase.rpc('get_pending_verifications_admin'),
    ]);

    if (statsRes.error) {
      const msg = statsRes.error.message;
      setFetchError(msg);
      toast.error(`Stats: ${msg}`);
      setLoading(false);
      setRefreshing(false);
      return;
    }

    const s = statsRes.data as Record<string, number>;
    setStats({
      totalUsers:           s.totalUsers           || 0,
      totalListings:        s.totalListings         || 0,
      totalOrders:          s.totalOrders           || 0,
      totalRevenue:         s.totalRevenue          || 0,
      pendingListings:      s.pendingListings        || 0,
      pendingVerifications: s.pendingVerifications  || 0,
      platformEarnings:     s.platformEarnings      || 0,
    });

    if (listingsRes.error) {
      toast.error(`Listings: ${listingsRes.error.message}`);
    } else {
      setPendingListings((listingsRes.data as unknown as PendingListing[]) || []);
    }

    if (verificationsRes.error) {
      toast.error(`Verifications: ${verificationsRes.error.message}`);
    } else {
      setPendingVerifications((verificationsRes.data as unknown as PendingVerification[]) || []);
    }

    setLoading(false);
    setRefreshing(false);
    setLastSynced(new Date());
  }

  /* ── Listing actions ── */
  async function approveListing(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('listings').update({ is_approved: true, status: 'active' }).eq('id', id);
    if (error) { toast.error('Failed to approve'); return; }
    setPendingListings((p) => p.filter((l) => l.id !== id));
    setStats((s) => ({ ...s, pendingListings: s.pendingListings - 1 }));
    toast.success('Listing approved');
  }

  async function rejectListing(id: string, reason: string) {
    const supabase = createClient();
    await supabase.from('listings').update({ status: 'rejected', is_approved: false, rejection_reason: reason }).eq('id', id);
    setPendingListings((p) => p.filter((l) => l.id !== id));
    setStats((s) => ({ ...s, pendingListings: s.pendingListings - 1 }));
    setRejectTarget(null);
    toast.success('Listing rejected');
  }

  /* ── Verification actions ── */
  async function approveVerification(userId: string) {
    const supabase = createClient();
    await supabase.from('profiles').update({ verification_status: 'approved', is_verified: true }).eq('id', userId);
    setPendingVerifications((p) => p.filter((v) => v.id !== userId));
    setStats((s) => ({ ...s, pendingVerifications: s.pendingVerifications - 1 }));
    toast.success('Seller verified!');
  }

  async function rejectVerification(userId: string, reason: string) {
    const supabase = createClient();
    await supabase.from('profiles').update({ verification_status: 'rejected', rejection_reason: reason }).eq('id', userId);
    setPendingVerifications((p) => p.filter((v) => v.id !== userId));
    setStats((s) => ({ ...s, pendingVerifications: s.pendingVerifications - 1 }));
    setRejectTarget(null);
    toast.success('Verification rejected');
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>;
  }

  if (fetchError) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-16 text-center">
        <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-8 space-y-4">
          <AlertTriangle className="h-10 w-10 text-red-500 mx-auto" />
          <h2 className="text-lg font-bold text-red-800 dark:text-red-200">Admin data failed to load</h2>
          <p className="text-sm text-red-700 dark:text-red-300 font-mono bg-red-100 dark:bg-red-900/40 rounded-lg px-4 py-2">{fetchError}</p>
          <p className="text-xs text-red-600 dark:text-red-400">
            Run <strong>003_fix_role_rls.sql</strong> then <strong>004_admin_rpcs.sql</strong> in Supabase SQL Editor, then refresh.
          </p>
          <Button variant="primary" onClick={() => fetchAdminData()}>
            <RefreshCw className="h-4 w-4" /> Retry
          </Button>
        </div>
      </div>
    );
  }

  /* ── Badge counts for tabs ── */
  const tabBadge: Partial<Record<TabId, number>> = {
    listings:      stats.pendingListings,
    verifications: stats.pendingVerifications,
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 sm:gap-4 mb-8">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 bg-maasai-red/10 rounded-xl flex items-center justify-center flex-shrink-0">
            <ShieldCheck className="h-5 w-5 text-maasai-red" />
          </div>
          <div>
            <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">Admin Panel</h1>
            <div className="flex items-center gap-2 mt-0.5 flex-wrap">
              <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">Maasai Heritage Market — Platform Management</p>
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
                </span>
                Live
              </span>
              {lastSynced && (
                <span className="text-xs text-maasai-brown/40 dark:text-maasai-beige/40">
                  · {lastSynced.toLocaleTimeString()}
                </span>
              )}
            </div>
          </div>
        </div>
        <button
          onClick={() => fetchAdminData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red border border-maasai-beige/40 dark:border-maasai-brown-light rounded-xl transition-colors self-start"
        >
          <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-maasai-beige/20 dark:bg-maasai-brown-light/20 rounded-xl p-1 mb-6 overflow-x-auto">
        {TABS.map(({ id, label, Icon }) => {
          const count = tabBadge[id];
          return (
            <button
              key={id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap',
                activeTab === id
                  ? 'bg-white dark:bg-maasai-brown text-maasai-red shadow-sm'
                  : 'text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red',
              )}
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
              {count != null && count > 0 && (
                <span className="min-w-[20px] h-5 px-1.5 rounded-full text-xs font-bold bg-maasai-red text-white flex items-center justify-center">
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── OVERVIEW ─────────────────────────────────────────────────────── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[
              { label: 'Total Users',       value: stats.totalUsers.toLocaleString(),    Icon: Users,         color: 'text-maasai-red' },
              { label: 'Total Listings',    value: stats.totalListings.toLocaleString(), Icon: Package,       color: 'text-maasai-red' },
              { label: 'Total Orders',      value: stats.totalOrders.toLocaleString(),   Icon: ShoppingBag,   color: 'text-maasai-red' },
              { label: 'Total Revenue',     value: formatKES(stats.totalRevenue),        Icon: DollarSign,    color: 'text-green-600'  },
              { label: 'Platform Earnings', value: formatKES(stats.platformEarnings),    Icon: TrendingUp,    color: 'text-green-600'  },
              { label: 'Pending Listings',  value: stats.pendingListings,               Icon: Clock,         color: 'text-amber-600'  },
              { label: 'Pending Verif.',    value: stats.pendingVerifications,          Icon: AlertTriangle, color: 'text-red-500'    },
            ].map(({ label, value, Icon, color }) => (
              <div key={label} className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-4 text-center">
                <Icon className={cn('h-5 w-5 mx-auto mb-2', color)} />
                <p className="text-lg font-bold text-maasai-black dark:text-white leading-tight">{value}</p>
                <p className="text-[11px] text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5 leading-tight">{label}</p>
              </div>
            ))}
          </div>

          <div className="space-y-3">
            {stats.pendingListings > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex items-center gap-3">
                <Clock className="h-5 w-5 text-amber-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-200 flex-1">
                  {stats.pendingListings} listing{stats.pendingListings !== 1 ? 's' : ''} awaiting approval
                </p>
                <Button size="sm" variant="primary" onClick={() => setActiveTab('listings')}>Review Now</Button>
              </div>
            )}
            {stats.pendingVerifications > 0 && (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-4 flex items-center gap-3">
                <ShieldCheck className="h-5 w-5 text-red-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-red-800 dark:text-red-200 flex-1">
                  {stats.pendingVerifications} seller verification{stats.pendingVerifications !== 1 ? 's' : ''} pending
                </p>
                <Button size="sm" variant="danger" onClick={() => setActiveTab('verifications')}>Review</Button>
              </div>
            )}
            {stats.pendingListings === 0 && stats.pendingVerifications === 0 && (
              <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-4 flex items-center gap-3">
                <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" />
                <p className="text-sm font-semibold text-green-800 dark:text-green-200">All caught up — no pending actions.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── PENDING LISTINGS ──────────────────────────────────────────────── */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </span>
              {lastSynced && (
                <span className="text-xs text-maasai-brown/40 dark:text-maasai-beige/40">
                  Updated {lastSynced.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={() => fetchAdminData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-maasai-brown dark:text-maasai-beige hover:text-maasai-red transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          {pendingListings.length === 0 ? (
            <EmptyState icon={CheckCircle} title="All caught up!" desc="No listings awaiting approval." />
          ) : (
            pendingListings.map((listing) => {
              const img = listing.images?.find((i) => i.is_primary)?.image_url || listing.images?.[0]?.image_url;
              return (
                <div key={listing.id} className="flex gap-4 p-4 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-maasai-beige/20">
                    {img
                      ? <img src={img} alt="" className="w-full h-full object-cover" />
                      : <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-maasai-beige" /></div>
                    }
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-maasai-black dark:text-white text-sm">{listing.title}</p>
                    <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">
                      by <span className="font-medium">{listing.seller?.shop_name || listing.seller?.full_name || 'Unknown'}</span>
                      {listing.seller?.is_verified && <span className="ml-1 text-maasai-red">(Verified)</span>}
                      {' · '}{listing.category?.name || 'Uncategorised'}
                      {' · '}{listing.listing_type === 'auction' ? <><Gavel className="inline h-3 w-3 mr-0.5" />Auction</> : <><Tag className="inline h-3 w-3 mr-0.5" />Fixed</>}
                      {' · '}{listing.price != null ? formatKES(listing.price) : 'Bidding'}
                      {' · '}{timeAgo(listing.created_at)}
                    </p>
                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <a href={`/marketplace/${listing.id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5" /> Preview</Button>
                      </a>
                      <Button size="sm" variant="primary" onClick={() => approveListing(listing.id)}>
                        <CheckCircle className="h-3.5 w-3.5" /> Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => setRejectTarget({ id: listing.id, name: listing.title, type: 'listing' })}>
                        <XCircle className="h-3.5 w-3.5" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ── VERIFICATIONS ─────────────────────────────────────────────────── */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
                </span>
                Live
              </span>
              {lastSynced && (
                <span className="text-xs text-maasai-brown/40 dark:text-maasai-beige/40">
                  Updated {lastSynced.toLocaleTimeString()}
                </span>
              )}
            </div>
            <button
              onClick={() => fetchAdminData(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-maasai-brown dark:text-maasai-beige hover:text-maasai-red transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>
          {pendingVerifications.length === 0 ? (
            <EmptyState icon={CheckCircle} title="No pending verifications" desc="All seller verifications are up to date." />
          ) : (
            pendingVerifications.map((v) => (
              <div key={v.id} className="p-5 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-bold text-maasai-black dark:text-white">{v.full_name}</p>
                    <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">
                      {v.email}
                      {v.phone && <> · {v.phone}</>}
                      {v.shop_name && <> · <span className="font-medium">{v.shop_name}</span></>}
                      {' · '}Submitted {timeAgo(v.created_at)}
                    </p>
                  </div>
                  <Badge variant="pending">Pending Review</Badge>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'National ID', url: v.national_id_url },
                    { label: 'KRA PIN Certificate', url: v.kra_pin_url },
                  ].map(({ label, url }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-maasai-brown/60 dark:text-maasai-beige/60 uppercase tracking-wider mb-1.5">{label}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer">
                          <div className="relative h-36 rounded-xl overflow-hidden bg-maasai-beige/20 hover:opacity-90 transition-opacity border border-maasai-beige/30">
                            <Image src={url} alt={label} fill className="object-contain" unoptimized />
                          </div>
                        </a>
                      ) : (
                        <div className="h-36 rounded-xl bg-maasai-beige/10 flex items-center justify-center text-maasai-brown/40 text-sm border border-dashed border-maasai-beige/30">
                          Not provided
                        </div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3 flex-wrap">
                  <Button variant="primary" onClick={() => approveVerification(v.id)}>
                    <CheckCircle className="h-4 w-4" /> Approve & Verify
                  </Button>
                  <Button variant="danger" onClick={() => setRejectTarget({ id: v.id, name: v.full_name, type: 'verification' })}>
                    <XCircle className="h-4 w-4" /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* ── ORDERS ────────────────────────────────────────────────────────── */}
      {activeTab === 'orders' && <OrdersTab />}

      {/* ── USERS ─────────────────────────────────────────────────────────── */}
      {activeTab === 'users' && <UsersTab />}

      {/* ── REJECT MODAL ──────────────────────────────────────────────────── */}
      {rejectTarget && (
        <RejectModal
          title={rejectTarget.name}
          onCancel={() => setRejectTarget(null)}
          onConfirm={(reason) => {
            if (rejectTarget.type === 'listing') rejectListing(rejectTarget.id, reason);
            else rejectVerification(rejectTarget.id, reason);
          }}
        />
      )}
    </div>
  );
}

/* ─── Orders Tab ─────────────────────────────────────────────────────────── */
function OrdersTab() {
  const [orders, setOrders]     = useState<OrderRow[]>([]);
  const [loading, setLoading]   = useState(true);
  const [filter, setFilter]     = useState<'all' | 'pending' | 'paid' | 'failed'>('all');

  useEffect(() => {
    const supabase = createClient();
    // RPC fixes: invalid listing FK join, 'order_status' vs 'status' column,
    // and 'paid' vs 'completed' payment_status enum value.
    supabase.rpc('get_all_orders_admin')
      .then(({ data, error }) => {
        if (error) toast.error(`Orders: ${error.message}`);
        setOrders((data as unknown as OrderRow[]) || []);
        setLoading(false);
      });
  }, []);

  const filtered = filter === 'all' ? orders : orders.filter((o) => o.payment_status === filter);

  const statusColor: Record<string, string> = {
    paid: 'text-green-600 bg-green-50 dark:bg-green-900/20',
    pending: 'text-amber-600 bg-amber-50 dark:bg-amber-900/20',
    failed: 'text-red-500 bg-red-50 dark:bg-red-900/20',
    refunded: 'text-blue-600 bg-blue-50 dark:bg-blue-900/20',
    completed: 'text-green-600 bg-green-50',
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-maasai-red" /></div>;

  return (
    <div className="space-y-4">
      {/* Filter pills */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'pending', 'paid', 'failed'] as const).map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className={cn('px-3 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors', filter === f ? 'bg-maasai-red text-white' : 'bg-maasai-beige/20 dark:bg-maasai-brown-light/30 text-maasai-brown/70 dark:text-maasai-beige/70 hover:text-maasai-red')}>
            {f === 'all' ? `All (${orders.length})` : f}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <EmptyState icon={ShoppingBag} title="No orders" desc="No orders match this filter." />
      ) : (
        <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-maasai-beige/10 dark:bg-maasai-brown-light/20 border-b border-maasai-beige/30 dark:border-maasai-brown-light">
                <tr>
                  {['Order ID', 'Buyer', 'Item', 'Total', 'Payment', 'Order Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-maasai-brown/60 dark:text-maasai-beige/60 uppercase tracking-wider whitespace-nowrap">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-maasai-beige/20 dark:divide-maasai-brown-light/20">
                {filtered.map((order) => (
                  <tr key={order.id} className="hover:bg-maasai-beige/5 dark:hover:bg-maasai-brown-light/10">
                    <td className="px-4 py-3 font-mono text-xs text-maasai-brown dark:text-maasai-beige">{order.id.slice(0, 8)}…</td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-maasai-black dark:text-white text-xs">{order.buyer?.full_name || '—'}</p>
                      <p className="text-maasai-brown/50 text-[11px]">{order.buyer?.email || ''}</p>
                    </td>
                    <td className="px-4 py-3 text-xs text-maasai-brown/70 dark:text-maasai-beige/70 max-w-[160px] truncate">{order.listing?.title || '—'}</td>
                    <td className="px-4 py-3 font-bold text-maasai-red text-sm whitespace-nowrap">{formatKES(order.total)}</td>
                    <td className="px-4 py-3">
                      <span className={cn('px-2 py-0.5 rounded-full text-xs font-semibold capitalize', statusColor[order.payment_status] || 'text-maasai-brown/60 bg-maasai-beige/20')}>
                        {order.payment_status}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded-full text-xs font-semibold capitalize bg-maasai-beige/20 dark:bg-maasai-brown-light/30 text-maasai-brown/70 dark:text-maasai-beige/70">
                        {order.order_status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-maasai-brown/60 dark:text-maasai-beige/60 text-xs whitespace-nowrap">{formatDate(order.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

/* ─── Users Tab ──────────────────────────────────────────────────────────── */
function UsersTab() {
  const { profile: currentUserProfile, refetchProfile } = useAuth();
  const [users, setUsers]           = useState<UserRow[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [query, setQuery]           = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'buyer' | 'seller' | 'admin' | 'ceo' | 'manager' | 'agent'>('all');
  const [changingRole, setChangingRole] = useState<string | null>(null);

  const loadUsers = async (quiet = false) => {
    if (quiet) setRefreshing(true);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('get_all_users_admin');
    if (error) toast.error(`Users: ${error.message}`);
    setUsers((data as unknown as UserRow[]) || []);
    setLoading(false);
    setRefreshing(false);
    setLastUpdated(new Date());
  };

  useEffect(() => {
    loadUsers();
    const supabase = createClient();
    // Re-fetch the full list whenever any profile row changes (insert / update / delete).
    // The RPC is SECURITY DEFINER so the re-fetch bypasses RLS correctly.
    const channel = supabase
      .channel('admin-users-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles' }, () => {
        loadUsers(true);
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changeRole(userId: string, newRole: string, town?: string) {
    setChangingRole(userId);
    const supabase = createClient();
    const { data, error } = await supabase.rpc('update_user_role', {
      p_target_user_id: userId,
      p_new_role:       newRole,
      p_town:           town ?? null,
    });
    if (error || data?.error) {
      toast.error(data?.error || error?.message || 'Failed to update role');
    } else {
      setUsers((prev) => prev.map((u) =>
        u.id === userId ? { ...u, role: newRole } : u
      ));
      toast.success(`Role updated to ${ROLE_LABELS[newRole as UserRole] ?? newRole}`);
      // If admin changed their OWN role, refresh both useAuth state AND
      // the Supabase session token. refreshSession() fires onAuthStateChange
      // in every listener (Navbar, useAuth) so they all re-fetch the profile
      // from DB — no page reload needed, no logout risk.
      if (currentUserProfile?.id === userId) {
        await refetchProfile();
        const supabase = createClient();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase.auth as any).refreshSession();
      }
    }
    setChangingRole(null);
  }

  const filtered = users.filter((u) => {
    const matchesRole  = roleFilter === 'all' || u.role === roleFilter;
    const q = query.toLowerCase();
    const matchesQuery = !q || u.full_name?.toLowerCase().includes(q) || u.email?.toLowerCase().includes(q) || u.shop_name?.toLowerCase().includes(q);
    return matchesRole && matchesQuery;
  });

  const roleBadge: Record<string, string> = {
    admin:   'bg-maasai-red text-white',
    ceo:     'bg-purple-700 text-white',
    manager: 'bg-indigo-600 text-white',
    agent:   'bg-amber-600 text-white',
    seller:  'bg-maasai-brown text-white dark:bg-maasai-brown-light',
    buyer:   'bg-maasai-beige/40 text-maasai-brown dark:text-maasai-beige border border-maasai-beige/60',
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-maasai-red" /></div>;

  return (
    <div className="space-y-4">
      {/* Header row: live indicator + refresh */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500" />
            </span>
            Live
          </span>
          {lastUpdated && (
            <span className="text-xs text-maasai-brown/40 dark:text-maasai-beige/40">
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
        </div>
        <button
          onClick={() => loadUsers(true)}
          disabled={refreshing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-maasai-brown dark:text-maasai-beige hover:text-maasai-red transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {/* Search + filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-maasai-beige" />
          <input
            value={query} onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, email or shop…"
            className="w-full pl-9 pr-4 py-2.5 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-sm text-maasai-black dark:text-white focus:outline-none focus:ring-2 focus:ring-maasai-red placeholder:text-maasai-beige"
          />
        </div>
        <div className="flex gap-1 p-1 bg-maasai-beige/20 dark:bg-maasai-brown-light/20 rounded-xl flex-wrap">
          {(['all', 'buyer', 'seller', 'admin', 'ceo', 'manager', 'agent'] as const).map((r) => (
            <button key={r} onClick={() => setRoleFilter(r)}
              className={cn('px-3 py-1.5 text-xs font-semibold rounded-lg capitalize transition-colors', roleFilter === r ? 'bg-white dark:bg-maasai-brown text-maasai-red shadow-sm' : 'text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red')}>
              {r === 'all' ? `All (${users.length})` : `${r} (${users.filter(u => u.role === r).length})`}
            </button>
          ))}
        </div>
      </div>

      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light overflow-hidden">
        <div className="px-4 py-2.5 border-b border-maasai-beige/20 dark:border-maasai-brown-light text-xs text-maasai-brown/50 dark:text-maasai-beige/50 flex items-center gap-2">
          Showing {filtered.length} of {users.length} users
          {refreshing && <Loader2 className="h-3 w-3 animate-spin text-maasai-red" />}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-maasai-beige/10 dark:bg-maasai-brown-light/20 border-b border-maasai-beige/30 dark:border-maasai-brown-light">
              <tr>
                {['User', 'Role', 'Verification', 'Sales', 'Joined', 'Actions'].map((h) => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-bold text-maasai-brown/60 dark:text-maasai-beige/60 uppercase tracking-wider whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-maasai-beige/20 dark:divide-maasai-brown-light/20">
              {filtered.map((user) => (
                <tr key={user.id} className="hover:bg-maasai-beige/5 dark:hover:bg-maasai-brown-light/10">
                  <td className="px-4 py-3">
                    <p className="font-medium text-maasai-black dark:text-white text-sm">{user.full_name || '—'}</p>
                    <p className="text-maasai-brown/50 dark:text-maasai-beige/50 text-xs">{user.email}</p>
                    {user.shop_name && <p className="text-maasai-red text-xs mt-0.5">{user.shop_name}</p>}
                    {user.role === 'agent' && user.town && (
                      <p className="text-amber-600 text-xs mt-0.5 font-medium">{user.town}</p>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn('px-2.5 py-1 rounded-full text-xs font-bold', roleBadge[user.role] || roleBadge.buyer)}>
                      {ROLE_LABELS[user.role as UserRole] ?? user.role}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {user.role === 'seller' ? (
                      user.is_verified
                        ? <VerifiedArtisanBadge />
                        : <span className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 capitalize">{user.verification_status?.replace('_', ' ') || 'unverified'}</span>
                    ) : <span className="text-maasai-brown/30 text-xs">—</span>}
                  </td>
                  <td className="px-4 py-3 text-maasai-black dark:text-white font-medium text-sm">{user.total_sales || 0}</td>
                  <td className="px-4 py-3 text-maasai-brown/60 dark:text-maasai-beige/60 text-xs whitespace-nowrap">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3">
                    <RoleDropdown
                      currentRole={user.role}
                      userId={user.id}
                      loading={changingRole === user.id}
                      onChange={(newRole, town) => changeRole(user.id, newRole, town)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ─── Role Dropdown (with town assignment for agents) ────────────────────── */

const KENYAN_TOWNS = [
  'Nairobi CBD', 'Westlands', 'Kasarani', 'Embakasi', 'Langata',
  'Narok', 'Kajiado', 'Ngong', 'Ongata Rongai',
  'Mombasa', 'Nyali', 'Bamburi', 'Likoni',
  'Kisumu', 'Nakuru', 'Eldoret', 'Nyeri', 'Meru', 'Thika',
];

function RoleDropdown({
  currentRole,
  userId,
  loading,
  onChange,
}: {
  currentRole: string;
  userId: string;
  loading: boolean;
  onChange: (role: string, town?: string) => void;
}) {
  const [open, setOpen]         = useState(false);
  const [pendingRole, setPending] = useState<string | null>(null);
  const [town, setTown]           = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false); setPending(null); setTown('');
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function selectRole(role: string) {
    if (role === 'agent') {
      setPending('agent');  // show town picker inline
    } else {
      onChange(role);
      setOpen(false);
    }
  }

  function confirmAgent() {
    if (!town) { toast.error('Please select a town for this agent'); return; }
    onChange('agent', town);
    setOpen(false);
    setPending(null);
    setTown('');
  }

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => { setOpen((o) => !o); setPending(null); }}
        disabled={loading}
        className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-lg border border-maasai-beige/40 dark:border-maasai-brown-light hover:border-maasai-red text-maasai-brown/70 dark:text-maasai-beige/70 hover:text-maasai-red transition-colors"
      >
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <UserCog className="h-3 w-3" />}
        Change role
        <ChevronDown className={cn('h-3 w-3 transition-transform', open && 'rotate-180')} />
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-1 w-52 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-lg z-10 overflow-hidden">
          {pendingRole === 'agent' ? (
            /* Town picker for agents */
            <div className="p-3 space-y-2">
              <p className="text-xs font-semibold text-maasai-brown/70 dark:text-maasai-beige/70">
                Assign town for this agent:
              </p>
              <select
                value={town}
                onChange={(e) => setTown(e.target.value)}
                className="w-full text-sm border border-maasai-beige/40 dark:border-maasai-brown-light rounded-lg px-2 py-1.5 bg-white dark:bg-maasai-brown dark:text-white focus:outline-none focus:ring-1 focus:ring-maasai-red"
              >
                <option value="">Select town…</option>
                {KENYAN_TOWNS.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <div className="flex gap-2">
                <button
                  onClick={confirmAgent}
                  className="flex-1 py-1.5 text-xs bg-maasai-red text-white rounded-lg font-semibold hover:bg-maasai-red-dark"
                >
                  Assign Agent
                </button>
                <button
                  onClick={() => { setPending(null); setTown(''); }}
                  className="px-2 py-1.5 text-xs border border-maasai-beige/40 rounded-lg hover:bg-maasai-beige/20"
                >
                  Back
                </button>
              </div>
            </div>
          ) : (
            /* Role list */
            ['buyer', 'seller', 'agent', 'manager', 'ceo']
              .filter((r) => r !== currentRole && !(r === 'admin' && currentRole === 'ceo'))
              .map((role) => (
                <button
                  key={role}
                  onClick={() => selectRole(role)}
                  className="w-full text-left px-4 py-2.5 text-sm text-maasai-black dark:text-white hover:bg-maasai-beige/20 dark:hover:bg-maasai-brown-light/30 transition-colors flex items-center justify-between"
                >
                  <span>{ROLE_LABELS[role as UserRole] ?? role}</span>
                  {role === 'agent' && (
                    <span className="text-xs text-maasai-beige">→ pick town</span>
                  )}
                </button>
              ))
          )}
        </div>
      )}
    </div>
  );
}

/* ─── Empty State ────────────────────────────────────────────────────────── */
function EmptyState({ icon: Icon, title, desc }: { icon: React.ElementType; title: string; desc: string }) {
  return (
    <div className="text-center py-16 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light">
      <Icon className="h-12 w-12 mx-auto text-maasai-beige mb-3" />
      <p className="font-bold text-maasai-black dark:text-white">{title}</p>
      <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mt-1">{desc}</p>
    </div>
  );
}
