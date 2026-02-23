'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/Button';
import { Badge, VerifiedArtisanBadge } from '@/components/ui/Badge';
import { formatKES, timeAgo } from '@/lib/utils';
import {
  Plus, Package, ShoppingBag, Star, TrendingUp, DollarSign,
  Eye, Edit3, Trash2, AlertTriangle, ShieldCheck, Upload, Loader2, CheckCircle, Clock
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import type { Listing } from '@/types';

interface Stats {
  totalListings: number;
  activeListings: number;
  totalOrders: number;
  totalRevenue: number;
  avgRating: number;
  pendingOrders: number;
}

export default function SellerDashboardPage() {
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listings, setListings] = useState<Listing[]>([]);
  const [recentOrders, setRecentOrders] = useState<Record<string, unknown>[]>([]);
  const [stats, setStats] = useState<Stats>({ totalListings: 0, activeListings: 0, totalOrders: 0, totalRevenue: 0, avgRating: 0, pendingOrders: 0 });
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'listings' | 'orders' | 'verification'>('overview');

  useEffect(() => {
    if (!authLoading && !profile) { router.push('/login'); return; }
    if (!authLoading && profile && profile.role !== 'seller') { router.push('/'); return; }
    if (profile) fetchDashboardData();
  }, [profile, authLoading]);

  async function fetchDashboardData() {
    const supabase = createClient();
    const [listingsRes, ordersRes] = await Promise.all([
      supabase.from('listings').select(`*, images:listing_images(image_url, is_primary), category:categories(name, slug)`).eq('seller_id', profile!.id).order('created_at', { ascending: false }),
      supabase.from('orders').select('id, total, status, created_at, items').contains('items', [{ seller_id: profile!.id }]).order('created_at', { ascending: false }).limit(10),
    ]);

    const allListings = listingsRes.data || [];
    setListings(allListings);
    setRecentOrders(ordersRes.data || []);

    const totalRevenue = (ordersRes.data || []).filter((o) => o.payment_status === 'completed').reduce((sum, o) => sum + (o.total as number || 0), 0);
    setStats({
      totalListings: allListings.length,
      activeListings: allListings.filter((l) => l.status === 'active').length,
      totalOrders: ordersRes.data?.length || 0,
      totalRevenue: totalRevenue * 0.91,
      avgRating: profile!.rating || 0,
      pendingOrders: (ordersRes.data || []).filter((o) => o.status === 'pending').length,
    });
    setLoading(false);
  }

  async function deleteListing(id: string) {
    if (!confirm('Delete this listing? This cannot be undone.')) return;
    const supabase = createClient();
    const { error } = await supabase.from('listings').delete().eq('id', id).eq('seller_id', profile!.id);
    if (error) { toast.error('Failed to delete listing'); return; }
    setListings((prev) => prev.filter((l) => l.id !== id));
    toast.success('Listing deleted');
  }

  if (authLoading || loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>;
  }

  const isVerified = profile?.is_verified;
  const verificationStatus = profile?.verification_status || 'not_submitted';

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
      {/* HEADER */}
      <div className="flex items-start justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white flex items-center gap-2">
            Seller Dashboard
            {isVerified && <VerifiedArtisanBadge />}
          </h1>
          <p className="text-maasai-brown/60 dark:text-maasai-beige/60 mt-1 text-sm">
            {profile?.shop_name || profile?.full_name}
          </p>
        </div>
        <Link href="/seller/listings/new">
          <Button variant="primary">
            <Plus className="h-4 w-4 mr-2" /> New Listing
          </Button>
        </Link>
      </div>

      {/* VERIFICATION BANNER */}
      {!isVerified && (
        <div className={cn('rounded-2xl p-4 mb-6 flex items-start gap-3', verificationStatus === 'not_submitted' ? 'bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700' : verificationStatus === 'pending' ? 'bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-700' : 'bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700')}>
          <AlertTriangle className={cn('h-5 w-5 flex-shrink-0 mt-0.5', verificationStatus === 'not_submitted' ? 'text-amber-600' : verificationStatus === 'pending' ? 'text-blue-600' : 'text-red-600')} />
          <div className="flex-1">
            <p className={cn('font-semibold text-sm', verificationStatus === 'not_submitted' ? 'text-amber-800 dark:text-amber-200' : verificationStatus === 'pending' ? 'text-blue-800 dark:text-blue-200' : 'text-red-800 dark:text-red-200')}>
              {verificationStatus === 'not_submitted' && 'Get Verified to unlock all features'}
              {verificationStatus === 'pending' && 'Verification under review (1–3 business days)'}
              {verificationStatus === 'rejected' && 'Verification rejected — please resubmit'}
            </p>
            <p className="text-xs mt-0.5 text-maasai-brown/60 dark:text-maasai-beige/60">
              {verificationStatus === 'not_submitted' && 'Submit your National ID and KRA PIN to unlock higher listing limits and the verified badge.'}
              {verificationStatus === 'pending' && 'Our team is reviewing your documents. You can still create listings in the meantime.'}
              {verificationStatus === 'rejected' && 'Your verification was rejected. Please re-submit with clearer documents.'}
            </p>
          </div>
          {verificationStatus !== 'pending' && (
            <Button size="sm" variant={verificationStatus === 'rejected' ? 'danger' : 'primary'} onClick={() => setActiveTab('verification')}>
              <Upload className="h-3.5 w-3.5 mr-1" /> {verificationStatus === 'rejected' ? 'Resubmit' : 'Verify Now'}
            </Button>
          )}
        </div>
      )}

      {/* TABS */}
      <div className="flex gap-1 bg-maasai-beige/20 dark:bg-maasai-brown-light/20 rounded-xl p-1 mb-6 overflow-x-auto">
        {[
          { id: 'overview', label: '📊 Overview' },
          { id: 'listings', label: `📦 My Listings (${stats.totalListings})` },
          { id: 'orders', label: `🛍️ Orders (${stats.totalOrders})` },
          { id: 'verification', label: '🛡️ Verification' },
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
              { label: 'Total Listings', value: stats.totalListings, icon: Package, color: 'text-maasai-red' },
              { label: 'Active', value: stats.activeListings, icon: Eye, color: 'text-green-600' },
              { label: 'Total Orders', value: stats.totalOrders, icon: ShoppingBag, color: 'text-maasai-blue' },
              { label: 'Pending', value: stats.pendingOrders, icon: Clock, color: 'text-amber-600' },
              { label: 'Revenue (net)', value: formatKES(stats.totalRevenue), icon: DollarSign, color: 'text-green-600' },
              { label: 'Rating', value: stats.avgRating.toFixed(1) + '★', icon: Star, color: 'text-maasai-gold' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-4 text-center">
                <Icon className={cn('h-6 w-6 mx-auto mb-2', color)} />
                <p className="text-xl font-bold text-maasai-black dark:text-white">{value}</p>
                <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">{label}</p>
              </div>
            ))}
          </div>

          {/* Recent listings preview */}
          {listings.slice(0, 3).length > 0 && (
            <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-maasai-black dark:text-white">Recent Listings</h3>
                <button onClick={() => setActiveTab('listings')} className="text-sm text-maasai-red hover:underline">View all</button>
              </div>
              <div className="space-y-3">
                {listings.slice(0, 3).map((l) => {
                  const images = (l.images as Array<{image_url: string; is_primary: boolean}>) || [];
                  const img = images.find((i) => i.is_primary)?.image_url || images[0]?.image_url;
                  return (
                    <div key={l.id} className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg overflow-hidden flex-shrink-0 bg-maasai-beige/20">
                        {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm text-maasai-black dark:text-white truncate">{l.title}</p>
                        <p className="text-xs text-maasai-brown/50">{formatKES(l.price)} · {timeAgo(l.created_at)}</p>
                      </div>
                      <Badge variant={l.is_approved ? (l.status === 'active' ? 'verified' : 'sold') : 'pending'}>
                        {l.is_approved ? l.status : 'Pending'}
                      </Badge>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* LISTINGS TAB */}
      {activeTab === 'listings' && (
        <div className="space-y-3">
          {listings.length === 0 ? (
            <div className="text-center py-16 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30">
              <Package className="h-14 w-14 mx-auto text-maasai-beige mb-3" />
              <p className="font-bold text-maasai-black dark:text-white mb-1">No listings yet</p>
              <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mb-4">Create your first listing to start selling</p>
              <Link href="/seller/listings/new"><Button variant="primary">Create First Listing</Button></Link>
            </div>
          ) : (
            listings.map((l) => {
              const images = (l.images as Array<{image_url: string; is_primary: boolean}>) || [];
              const img = images.find((i) => i.is_primary)?.image_url || images[0]?.image_url;
              return (
                <div key={l.id} className="flex items-center gap-4 p-4 bg-white dark:bg-maasai-brown rounded-xl border border-maasai-beige/30 dark:border-maasai-brown-light">
                  <div className="w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 bg-maasai-beige/20">
                    {img && <img src={img} alt="" className="w-full h-full object-cover" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <Link href={`/marketplace/${l.id}`} className="font-semibold text-maasai-black dark:text-white hover:text-maasai-red text-sm line-clamp-1">{l.title}</Link>
                    <p className="text-maasai-red font-bold text-sm">{formatKES(l.price)}</p>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="text-xs text-maasai-brown/50">{l.listing_type === 'auction' ? '🔔 Auction' : '🏷️ Fixed'}</span>
                      <span className="text-xs text-maasai-brown/50 flex items-center gap-1"><Eye className="h-3 w-3" />{l.views || 0}</span>
                      <Badge variant={l.is_approved ? (l.status === 'active' ? 'verified' : 'sold') : 'pending'} className="text-xs">
                        {l.is_approved ? l.status : 'Awaiting Approval'}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Link href={`/seller/listings/${l.id}/edit`}>
                      <button className="p-2 rounded-lg hover:bg-maasai-beige/20 text-maasai-brown/60 hover:text-maasai-blue transition-colors">
                        <Edit3 className="h-4 w-4" />
                      </button>
                    </Link>
                    <button onClick={() => deleteListing(l.id)} className="p-2 rounded-lg hover:bg-red-50 text-maasai-brown/60 hover:text-red-500 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* ORDERS TAB */}
      {activeTab === 'orders' && (
        <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light overflow-hidden">
          {recentOrders.length === 0 ? (
            <div className="text-center py-16">
              <ShoppingBag className="h-14 w-14 mx-auto text-maasai-beige mb-3" />
              <p className="font-bold text-maasai-black dark:text-white">No orders yet</p>
              <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mt-1">Orders will appear here when customers buy your items</p>
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead className="bg-maasai-beige/10 dark:bg-maasai-brown-light/20 border-b border-maasai-beige/30 dark:border-maasai-brown-light">
                <tr>
                  {['Order ID', 'Total', 'Status', 'Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-bold text-maasai-brown/60 dark:text-maasai-beige/60 uppercase tracking-wider">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-maasai-beige/20 dark:divide-maasai-brown-light/20">
                {recentOrders.map((order) => (
                  <tr key={order.id as string} className="hover:bg-maasai-beige/5 dark:hover:bg-maasai-brown-light/10">
                    <td className="px-4 py-3 font-mono text-xs text-maasai-brown dark:text-maasai-beige">{order.id as string}</td>
                    <td className="px-4 py-3 font-bold text-maasai-red">{formatKES(order.total as number)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={order.status === 'delivered' ? 'verified' : order.status === 'pending' ? 'pending' : 'auction'}>
                        {order.status as string}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-maasai-brown/60 dark:text-maasai-beige/60 text-xs">{timeAgo(order.created_at as string)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* VERIFICATION TAB */}
      {activeTab === 'verification' && (
        <VerificationTab profile={profile!} onUpdate={fetchDashboardData} />
      )}
    </div>
  );
}

function VerificationTab({ profile, onUpdate }: { profile: Record<string, unknown>; onUpdate: () => void }) {
  const [nationalId, setNationalId] = useState<File | null>(null);
  const [kraPin, setKraPin] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (profile.is_verified) {
    return (
      <div className="text-center py-16 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30">
        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <CheckCircle className="h-8 w-8 text-green-600" />
        </div>
        <h3 className="text-xl font-bold text-maasai-black dark:text-white mb-1">You are a Verified Artisan!</h3>
        <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">Your National ID and KRA PIN have been verified by our team.</p>
        <VerifiedArtisanBadge className="mt-3 mx-auto" />
      </div>
    );
  }

  async function submitVerification() {
    if (!nationalId || !kraPin) { toast.error('Please upload both documents'); return; }
    setSubmitting(true);
    try {
      const supabase = createClient();
      const uploadDoc = async (file: File, type: string) => {
        const path = `verifications/${profile.id}/${type}-${Date.now()}.${file.name.split('.').pop()}`;
        const { error } = await supabase.storage.from('verification-docs').upload(path, file, { upsert: true });
        if (error) throw error;
        return supabase.storage.from('verification-docs').getPublicUrl(path).data.publicUrl;
      };
      const [nationalIdUrl, kraPinUrl] = await Promise.all([uploadDoc(nationalId, 'national-id'), uploadDoc(kraPin, 'kra-pin')]);
      await supabase.from('profiles').update({
        national_id_url: nationalIdUrl,
        kra_pin_url: kraPinUrl,
        verification_status: 'pending',
      }).eq('id', profile.id);
      toast.success('Documents submitted! Our team will review within 1–3 business days.');
      onUpdate();
    } catch (error: unknown) {
      toast.error(error instanceof Error ? error.message : 'Upload failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-xl">
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-6 space-y-5">
        <div>
          <h3 className="font-bold text-maasai-black dark:text-white mb-1 flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-maasai-red" /> Artisan Verification
          </h3>
          <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60">Upload clear photos or scans of your documents. All documents are encrypted and stored securely per KDPA 2019.</p>
        </div>
        {[
          { label: 'National ID (front & back)', file: nationalId, onChange: setNationalId, accept: 'image/*,application/pdf' },
          { label: 'KRA PIN Certificate', file: kraPin, onChange: setKraPin, accept: 'image/*,application/pdf' },
        ].map(({ label, file, onChange, accept }) => (
          <div key={label}>
            <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">{label}</label>
            <label className={cn('flex items-center gap-3 p-4 rounded-xl border-2 border-dashed cursor-pointer transition-colors', file ? 'border-green-500 bg-green-50 dark:bg-green-900/20' : 'border-maasai-beige dark:border-maasai-brown-light hover:border-maasai-red')}>
              {file ? <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0" /> : <Upload className="h-5 w-5 text-maasai-brown/50 flex-shrink-0" />}
              <span className="text-sm text-maasai-brown dark:text-maasai-beige truncate">{file ? file.name : 'Click to upload (JPG, PNG or PDF)'}</span>
              <input type="file" accept={accept} className="sr-only" onChange={(e) => onChange(e.target.files?.[0] || null)} />
            </label>
          </div>
        ))}
        <Button variant="primary" fullWidth loading={submitting} onClick={submitVerification}>
          Submit for Verification
        </Button>
        <p className="text-xs text-center text-maasai-brown/50 dark:text-maasai-beige/50">
          🔒 Documents are reviewed within 1–3 business days and stored per Kenya Data Protection Act 2019.
        </p>
      </div>
    </div>
  );
}
