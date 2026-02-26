'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import {
  User, Mail, Phone, MapPin, FileText, Camera, ShieldCheck,
  Store, Loader2, CheckCircle2, AlertCircle, LogOut, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

const KENYAN_REGIONS = [
  'Nairobi', 'Narok', 'Kajiado', 'Mombasa', 'Kisumu',
  'Nakuru', 'Eldoret', 'Nyeri', 'Meru', 'Thika', 'Other',
];

export default function ProfilePage() {
  const { profile, loading, signOut, refetchProfile } = useAuth();
  const router = useRouter();
  const supabase = createClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    bio: '',
    location: '',
    region: '',
    shop_name: '',
    shop_description: '',
  });

  useEffect(() => {
    if (profile) {
      setForm({
        full_name:        profile.full_name        || '',
        phone:            profile.phone            || '',
        bio:              profile.bio              || '',
        location:         profile.location         || '',
        region:           profile.region           || '',
        shop_name:        profile.shop_name        || '',
        shop_description: profile.shop_description || '',
      });
    }
  }, [profile]);

  async function handleSave() {
    if (!profile) return;
    if (!form.full_name.trim()) { toast.error('Name is required'); return; }
    setSaving(true);
    const { error, count } = await supabase
      .from('profiles')
      .update({
        full_name:        form.full_name.trim(),
        phone:            form.phone.trim() || null,
        bio:              form.bio.trim() || null,
        location:         form.location.trim() || null,
        region:           form.region || null,
        shop_name:        form.shop_name.trim() || null,
        shop_description: form.shop_description.trim() || null,
      })
      .eq('id', profile.id);

    if (error) {
      toast.error(error.message || 'Failed to save changes');
    } else {
      toast.success('Profile updated');
      await refetchProfile();
    }
    setSaving(false);
  }

  async function handleAvatarUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (file.size > 2 * 1024 * 1024) { toast.error('Image must be under 2 MB'); return; }

    setUploading(true);
    const ext = file.name.split('.').pop();
    const path = `${profile.id}/avatar.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(path, file, { upsert: true });

    if (uploadError) { toast.error('Upload failed'); setUploading(false); return; }

    const { data: { publicUrl } } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(path);

    await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', profile.id);
    toast.success('Avatar updated');
    await refetchProfile();
    setUploading(false);
  }

  async function handleSignOut() {
    await signOut();
    router.push('/');
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-maasai-red" />
      </div>
    );
  }

  if (!profile) {
    router.push('/login?redirect=/profile');
    return null;
  }

  const initials = profile.full_name
    ?.split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase() || 'U';

  const verificationBadge = {
    not_submitted: { label: 'Not submitted', color: 'text-maasai-beige', bg: 'bg-maasai-beige/10', Icon: AlertCircle },
    pending:       { label: 'Under review',  color: 'text-yellow-600',   bg: 'bg-yellow-50',        Icon: Loader2 },
    approved:      { label: 'Verified',      color: 'text-green-600',    bg: 'bg-green-50',         Icon: CheckCircle2 },
    rejected:      { label: 'Rejected',      color: 'text-maasai-red',   bg: 'bg-maasai-red/10',   Icon: AlertCircle },
  }[profile.verification_status] ?? { label: 'Unknown', color: 'text-maasai-beige', bg: 'bg-maasai-beige/10', Icon: AlertCircle };

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10 space-y-6">

      {/* Header card */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card p-6">
        <div className="flex items-start gap-5">
          {/* Avatar */}
          <div className="relative flex-shrink-0">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt={profile.full_name}
                className="w-20 h-20 rounded-2xl object-cover ring-2 ring-maasai-red/20" />
            ) : (
              <div className="w-20 h-20 rounded-2xl bg-maasai-gradient flex items-center justify-center text-white text-2xl font-bold shadow-maasai">
                {initials}
              </div>
            )}
            <button onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="absolute -bottom-2 -right-2 w-7 h-7 bg-maasai-red hover:bg-maasai-red-dark text-white rounded-full flex items-center justify-center shadow-md transition-colors">
              {uploading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Camera className="h-3.5 w-3.5" />}
            </button>
            <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="font-display font-bold text-xl text-maasai-black dark:text-white leading-tight">
                {profile.full_name}
              </h1>
              {profile.is_verified && (
                <ShieldCheck className="h-5 w-5 text-maasai-red flex-shrink-0" />
              )}
            </div>
            <p className="text-sm text-maasai-beige mt-0.5">{profile.email}</p>
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full capitalize', 'bg-maasai-red/10 text-maasai-red')}>
                {profile.role}
              </span>
              {profile.role === 'seller' && (
                <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-full', verificationBadge.bg, verificationBadge.color)}>
                  <verificationBadge.Icon className="h-3 w-3" />
                  {verificationBadge.label}
                </span>
              )}
            </div>
          </div>

          <button onClick={handleSignOut}
            className="flex items-center gap-1.5 text-sm text-maasai-beige hover:text-maasai-red transition-colors flex-shrink-0">
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </div>

        {/* Stats row for sellers */}
        {profile.role === 'seller' && (
          <div className="grid grid-cols-3 gap-4 mt-5 pt-5 border-t border-maasai-beige/30 dark:border-maasai-brown-light">
            {[
              { label: 'Total Sales', value: profile.total_sales },
              { label: 'Rating', value: profile.rating ? `${profile.rating} / 5` : '—' },
              { label: 'Reviews', value: (profile as any).total_reviews || 0 },
            ].map(({ label, value }) => (
              <div key={label} className="text-center">
                <p className="font-bold text-lg text-maasai-black dark:text-white">{value}</p>
                <p className="text-xs text-maasai-beige mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Edit form */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card p-6">
        <h2 className="font-semibold text-maasai-black dark:text-white mb-5">Personal Information</h2>
        <div className="space-y-4">
          <Field label="Full Name" Icon={User}>
            <input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })}
              placeholder="Your full name" className={inputCls} />
          </Field>

          <Field label="Email" Icon={Mail}>
            <input value={profile.email} disabled
              className={cn(inputCls, 'opacity-50 cursor-not-allowed')} />
          </Field>

          <Field label="Phone" Icon={Phone}>
            <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+1 555 000 0000" className={inputCls} />
          </Field>

          <div className="grid sm:grid-cols-2 gap-4">
            <Field label="City / Town" Icon={MapPin}>
              <input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })}
                placeholder="e.g. Nairobi" className={inputCls} />
            </Field>
            <Field label="Region" Icon={MapPin}>
              <select value={form.region} onChange={(e) => setForm({ ...form, region: e.target.value })}
                className={inputCls}>
                <option value="">Select region</option>
                {KENYAN_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </Field>
          </div>

          <Field label="Bio" Icon={FileText}>
            <textarea value={form.bio} onChange={(e) => setForm({ ...form, bio: e.target.value })}
              placeholder="A short bio about yourself..." rows={3}
              className={cn(inputCls, 'resize-none')} />
          </Field>
        </div>
      </div>

      {/* Seller info */}
      {profile.role === 'seller' && (
        <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card p-6">
          <h2 className="font-semibold text-maasai-black dark:text-white mb-5">Shop Information</h2>
          <div className="space-y-4">
            <Field label="Shop / Brand Name" Icon={Store}>
              <input value={form.shop_name} onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
                placeholder="e.g. Amara Crafts" className={inputCls} />
            </Field>
            <Field label="Shop Description" Icon={FileText}>
              <textarea value={form.shop_description}
                onChange={(e) => setForm({ ...form, shop_description: e.target.value })}
                placeholder="Describe your shop and what you sell..." rows={3}
                className={cn(inputCls, 'resize-none')} />
            </Field>
          </div>
        </div>
      )}

      {/* Upgrade to seller */}
      {profile.role === 'buyer' && (
        <Link href="/seller/register"
          className="flex items-center justify-between bg-maasai-gradient rounded-2xl p-5 text-white hover:opacity-90 transition-opacity">
          <div>
            <p className="font-semibold">Become a Seller</p>
            <p className="text-white/70 text-sm mt-0.5">List your crafts and reach buyers across Kenya</p>
          </div>
          <ChevronRight className="h-5 w-5 text-white/70 flex-shrink-0" />
        </Link>
      )}

      {/* Quick links */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card divide-y divide-maasai-beige/30 dark:divide-maasai-brown-light">
        {[
          { href: '/orders', label: 'My Orders' },
          { href: '/wishlist', label: 'Wishlist' },
          ...(profile.role === 'seller' ? [{ href: '/seller/dashboard', label: 'Seller Dashboard' }] : []),
          ...(['admin', 'ceo'].includes(profile.role)     ? [{ href: '/admin',   label: 'Admin Panel'        }] : []),
          ...(profile.role === 'manager'                  ? [{ href: '/manager', label: 'Manager Dashboard'   }] : []),
          ...(profile.role === 'agent'                    ? [{ href: '/agent',   label: 'Agent Portal'        }] : []),
        ].map(({ href, label }) => (
          <Link key={href} href={href}
            className="flex items-center justify-between px-5 py-3.5 hover:bg-maasai-beige/10 dark:hover:bg-maasai-brown-light/30 transition-colors">
            <span className="text-sm font-medium text-maasai-black dark:text-white">{label}</span>
            <ChevronRight className="h-4 w-4 text-maasai-beige" />
          </Link>
        ))}
      </div>

      {/* Save button */}
      <Button variant="primary" size="lg" fullWidth loading={saving} onClick={handleSave}>
        Save Changes
      </Button>
    </div>
  );
}

const inputCls = 'w-full pl-10 pr-4 py-3 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red transition-shadow placeholder:text-maasai-beige';

function Field({ label, Icon, children }: { label: string; Icon: React.ElementType; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-maasai-beige uppercase tracking-wider mb-1.5">{label}</label>
      <div className="relative">
        <Icon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-maasai-beige pointer-events-none" />
        {children}
      </div>
    </div>
  );
}
