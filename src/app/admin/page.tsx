'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { formatKES, timeAgo } from '@/lib/utils';
import {
  ShieldCheck, Package, Users, CheckCircle, XCircle, Eye,
  Loader2, TrendingUp, AlertTriangle, DollarSign, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface PendingListing {
  id: string; title: string; price: number; listing_type: string; created_at: string;
  seller: { full_name: string; shop_name: string | null; is_verified: boolean };
  images: Array<{ image_url: string; is_primary: boolean }>;
}

interface PendingVerification {
  id: string; full_name: string; email: string; phone: string;
  national_id_url: string; kra_pin_url: string; created_at: string;
}

interface PlatformStats {
  totalUsers: number; totalListings: number; totalOrders: number;
  totalRevenue: number; pendingListings: number; pendingVerifications: number;
}

export default function AdminDashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'verifications' | 'users'>('overview');
  const [pendingListings, setPendingListings] = useState<PendingListing[]>([]);
  const [pendingVerifications, setPendingVerifications] = useState<PendingVerification[]>([]);
  const [stats, setStats] = useState<PlatformStats>({ totalUsers: 0, totalListings: 0, totalOrders: 0, totalRevenue: 0, pendingListings: 0, pendingVerifications: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!profile || profile.role !== 'admin')) { router.push('/'); return; }
    if (profile?.role === 'admin') fetchAdminData();
  }, [profile, authLoading]);

  async function fetchAdminData() {
    const supabase = createClient();
    const [listingsRes, verificationsRes, usersRes, ordersRes] = await Promise.all([
      supabase.from('listings').select(`id, title, price, listing_type, created_at, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary)`).eq('is_approved', false).eq('status', 'active').order('created_at', { ascending: true }).limit(50),
      supabase.from('profiles').select('id, full_name, email, phone, national_id_url, kra_pin_url, created_at').eq('verification_status', 'pending').order('created_at', { ascending: true }).limit(50),
      supabase.from('profiles').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('total').eq('payment_status', 'completed'),
    ]);

    setPendingListings((listingsRes.data as unknown as PendingListing[]) || []);
    setPendingVerifications((verificationsRes.data as unknown as PendingVerification[]) || []);
    const totalRevenue = (ordersRes.data || []).reduce((sum, o) => sum + (o.total || 0), 0);
    setStats({
      totalUsers: usersRes.count || 0,
      totalListings: 0,
      totalOrders: ordersRes.data?.length || 0,
      totalRevenue,
      pendingListings: listingsRes.data?.length || 0,
      pendingVerifications: verificationsRes.data?.length || 0,
    });
    setLoading(false);
  }

  async function approveListing(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from('listings').update({ is_approved: true }).eq('id', id);
    if (error) { toast.error('Failed to approve'); return; }
    setPendingListings((prev) => prev.filter((l) => l.id !== id));
    toast.success('Listing approved!');
  }

  async function rejectListing(id: string) {
    const reason = prompt('Rejection reason (optional):');
    const supabase = createClient();
    await supabase.from('listings').update({ status: 'rejected', rejection_reason: reason || null }).eq('id', id);
    setPendingListings((prev) => prev.filter((l) => l.id !== id));
    toast.success('Listing rejected');
  }

  async function approveVerification(userId: string) {
    const supabase = createClient();
    await supabase.from('profiles').update({ verification_status: 'approved', is_verified: true }).eq('id', userId);
    setPendingVerifications((prev) => prev.filter((v) => v.id !== userId));
    toast.success('Seller verified!');
  }

  async function rejectVerification(userId: string) {
    const reason = prompt('Rejection reason:');
    if (!reason) return;
    const supabase = createClient();
    await supabase.from('profiles').update({ verification_status: 'rejected', rejection_reason: reason }).eq('id', userId);
    setPendingVerifications((prev) => prev.filter((v) => v.id !== userId));
    toast.success('Verification rejected');
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      <div className="flex items-center gap-3 mb-8">
        <div className="w-10 h-10 bg-maasai-red/10 rounded-xl flex items-center justify-center">
          <ShieldCheck className="h-5 w-5 text-maasai-red" />
        </div>
        <div>
          <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">Admin Dashboard</h1>
          <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">Maasai Heritage Market — Platform Management</p>
        </div>
      </div>

      {/* TABS */}
      <div className="flex gap-1 bg-maasai-beige/20 dark:bg-maasai-brown-light/20 rounded-xl p-1 mb-6 overflow-x-auto">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'listings', label: `📦 Pending Listings ${stats.pendingListings > 0 ? `(${stats.pendingListings})` : ''}` },
          { id: 'verifications', label: `🛡️ Verifications ${stats.pendingVerifications > 0 ? `(${stats.pendingVerifications})` : ''}` },
          { id: 'users', label: `👥 Users` },
        ].map(({ id, label }) => (
          <button key={id} onClick={() => setActiveTab(id as typeof activeTab)}
            className={cn('px-4 py-2 text-sm font-semibold rounded-lg transition-colors whitespace-nowrap', activeTab === id ? 'bg-white dark:bg-maasai-brown text-maasai-red shadow-sm' : 'text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red')}>
            {label}
          </button>
        ))}
      </div>

      {/* OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
            {[
              { label: 'Total Users', value: stats.totalUsers.toLocaleString(), icon: Users, color: 'text-maasai-blue' },
              { label: 'Total Revenue', value: formatKES(stats.totalRevenue), icon: DollarSign, color: 'text-green-600' },
              { label: 'Total Orders', value: stats.totalOrders.toLocaleString(), icon: Package, color: 'text-maasai-red' },
              { label: 'Platform Earnings', value: formatKES(stats.totalRevenue * 0.09), icon: TrendingUp, color: 'text-maasai-gold' },
              { label: 'Pending Listings', value: stats.pendingListings, icon: Clock, color: 'text-amber-600' },
              { label: 'Pending Verif.', value: stats.pendingVerifications, icon: AlertTriangle, color: 'text-red-500' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-4 text-center">
                <Icon className={cn('h-6 w-6 mx-auto mb-2', color)} />
                <p className="text-xl font-bold text-maasai-black dark:text-white">{value}</p>
                <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {stats.pendingListings > 0 && (
            <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-2xl p-4 flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-amber-800 dark:text-amber-200">
                {stats.pendingListings} listing{stats.pendingListings !== 1 ? 's' : ''} awaiting approval
              </p>
              <Button size="sm" variant="primary" onClick={() => setActiveTab('listings')} className="ml-auto">Review Now</Button>
            </div>
          )}
          {stats.pendingVerifications > 0 && (
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-2xl p-4 flex items-center gap-3">
              <ShieldCheck className="h-5 w-5 text-red-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-red-800 dark:text-red-200">
                {stats.pendingVerifications} seller verification{stats.pendingVerifications !== 1 ? 's' : ''} pending review
              </p>
              <Button size="sm" variant="danger" onClick={() => setActiveTab('verifications')} className="ml-auto">Review</Button>
            </div>
          )}
        </div>
      )}

      {/* PENDING LISTINGS */}
      {activeTab === 'listings' && (
        <div className="space-y-4">
          {pendingListings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30">
              <CheckCircle className="h-14 w-14 mx-auto text-green-500 mb-3" />
              <p className="font-bold text-maasai-black dark:text-white">All caught up!</p>
              <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mt-1">No pending listings to review.</p>
            </div>
          ) : (
            pendingListings.map((listing) => {
              const primaryImg = listing.images?.find((i) => i.is_primary)?.image_url || listing.images?.[0]?.image_url;
              return (
                <div key={listing.id} className="flex gap-4 p-4 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                  <div className="w-20 h-20 rounded-xl overflow-hidden flex-shrink-0 bg-maasai-beige/20">
                    {primaryImg ? <img src={primaryImg} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-8 w-8 text-maasai-beige" /></div>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-semibold text-maasai-black dark:text-white text-sm">{listing.title}</p>
                        <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">
                          by {listing.seller?.shop_name || listing.seller?.full_name} · {formatKES(listing.price)} · {listing.listing_type === 'auction' ? '🔔 Auction' : '🏷️ Fixed'} · {timeAgo(listing.created_at)}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 mt-3">
                      <a href={`/marketplace/${listing.id}`} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="outline"><Eye className="h-3.5 w-3.5 mr-1" /> Preview</Button>
                      </a>
                      <Button size="sm" variant="primary" onClick={() => approveListing(listing.id)}>
                        <CheckCircle className="h-3.5 w-3.5 mr-1" /> Approve
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => rejectListing(listing.id)}>
                        <XCircle className="h-3.5 w-3.5 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* VERIFICATIONS */}
      {activeTab === 'verifications' && (
        <div className="space-y-4">
          {pendingVerifications.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30">
              <CheckCircle className="h-14 w-14 mx-auto text-green-500 mb-3" />
              <p className="font-bold text-maasai-black dark:text-white">No pending verifications</p>
            </div>
          ) : (
            pendingVerifications.map((v) => (
              <div key={v.id} className="p-5 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <div>
                    <p className="font-bold text-maasai-black dark:text-white">{v.full_name}</p>
                    <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">{v.email} · {v.phone} · Submitted {timeAgo(v.created_at)}</p>
                  </div>
                  <Badge variant="pending">Pending Review</Badge>
                </div>
                <div className="grid sm:grid-cols-2 gap-3 mb-4">
                  {[
                    { label: 'National ID', url: v.national_id_url },
                    { label: 'KRA PIN', url: v.kra_pin_url },
                  ].map(({ label, url }) => (
                    <div key={label}>
                      <p className="text-xs font-semibold text-maasai-brown/60 dark:text-maasai-beige/60 mb-1">{label}</p>
                      {url ? (
                        <a href={url} target="_blank" rel="noopener noreferrer" className="block">
                          <div className="relative h-32 rounded-xl overflow-hidden bg-maasai-beige/20 hover:opacity-90 transition-opacity">
                            <Image src={url} alt={label} fill className="object-contain" />
                          </div>
                        </a>
                      ) : (
                        <div className="h-32 rounded-xl bg-maasai-beige/10 flex items-center justify-center text-maasai-brown/40 text-sm">Not provided</div>
                      )}
                    </div>
                  ))}
                </div>
                <div className="flex gap-3">
                  <Button variant="primary" onClick={() => approveVerification(v.id)}>
                    <CheckCircle className="h-4 w-4 mr-2" /> Approve & Verify
                  </Button>
                  <Button variant="danger" onClick={() => rejectVerification(v.id)}>
                    <XCircle className="h-4 w-4 mr-2" /> Reject
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {/* USERS TAB */}
      {activeTab === 'users' && (
        <UsersTab />
      )}
    </div>
  );
}

function UsersTab() {
  const [users, setUsers] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const supabase = createClient();
    supabase.from('profiles').select('id, full_name, email, role, is_verified, verification_status, created_at, total_sales, rating').order('created_at', { ascending: false }).limit(100).then(({ data }) => {
      setUsers(data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-maasai-red" /></div>;

  return (
    <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-maasai-beige/10 dark:bg-maasai-brown-light/20 border-b border-maasai-beige/30 dark:border-maasai-brown-light">
          <tr>
            {['Name', 'Email', 'Role', 'Status', 'Joined'].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-bold text-maasai-brown/60 dark:text-maasai-beige/60 uppercase tracking-wider">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-maasai-beige/20 dark:divide-maasai-brown-light/20">
          {users.map((user) => (
            <tr key={user.id as string} className="hover:bg-maasai-beige/5 dark:hover:bg-maasai-brown-light/10">
              <td className="px-4 py-3 font-medium text-maasai-black dark:text-white">{user.full_name as string}</td>
              <td className="px-4 py-3 text-maasai-brown/70 dark:text-maasai-beige/70 text-xs">{user.email as string}</td>
              <td className="px-4 py-3">
                <Badge variant={user.role === 'admin' ? 'hot' : user.role === 'seller' ? 'auction' : 'new'}>
                  {user.role as string}
                </Badge>
              </td>
              <td className="px-4 py-3">
                {user.role === 'seller' ? (
                  <Badge variant={user.is_verified ? 'verified' : user.verification_status === 'pending' ? 'pending' : 'sold'}>
                    {user.is_verified ? '✅ Verified' : user.verification_status as string || 'unverified'}
                  </Badge>
                ) : <span className="text-maasai-brown/40 text-xs">—</span>}
              </td>
              <td className="px-4 py-3 text-maasai-brown/60 dark:text-maasai-beige/60 text-xs">{timeAgo(user.created_at as string)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
