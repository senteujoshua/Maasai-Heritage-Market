'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Store, FileText, Phone, ShieldCheck, Loader2, CheckCircle2, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';
import Link from 'next/link';

export default function BecomeSellerPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();
  const supabase = createClient();

  const [step, setStep] = useState<1 | 2>(1);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    shop_name: '',
    shop_description: '',
    phone: '',
  });

  useEffect(() => {
    if (!loading && profile) {
      if (['seller', 'admin', 'ceo', 'manager'].includes(profile.role)) {
        router.replace('/seller/dashboard');
      }
      if (profile.phone) setForm((f) => ({ ...f, phone: profile.phone! }));
    }
  }, [profile, loading, router]);

  async function handleSubmit() {
    if (!profile) return;
    if (!form.shop_name.trim()) { toast.error('Shop name is required'); return; }
    if (!form.phone.trim()) { toast.error('Phone number is required'); return; }

    setSubmitting(true);
    const { error } = await supabase
      .from('profiles')
      .update({
        role: 'seller',
        shop_name: form.shop_name.trim(),
        shop_description: form.shop_description.trim() || null,
        phone: form.phone.trim(),
        verification_status: 'not_submitted',
      })
      .eq('id', profile.id);

    if (error) {
      toast.error('Something went wrong. Please try again.');
      setSubmitting(false);
      return;
    }

    setStep(2);
    setSubmitting(false);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-7 w-7 animate-spin text-maasai-red" />
      </div>
    );
  }

  const inputCls = 'w-full px-4 py-3 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red transition-shadow placeholder:text-maasai-beige';

  if (step === 2) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-maasai-red/10 mb-6">
            <CheckCircle2 className="h-10 w-10 text-maasai-red" />
          </div>
          <h1 className="font-display text-3xl font-bold text-maasai-black dark:text-white mb-3">
            You&apos;re now a Seller!
          </h1>
          <p className="text-maasai-beige dark:text-maasai-beige/80 mb-8 leading-relaxed">
            Your seller account for <span className="font-semibold text-maasai-black dark:text-white">{form.shop_name}</span> is active.
            Start listing your items or complete your verification to unlock all features.
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <Link href="/seller/dashboard"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-maasai-red hover:bg-maasai-red-dark text-white font-semibold rounded-xl transition-colors">
              Go to Dashboard
            </Link>
            <Link href="/seller/listings/new"
              className="inline-flex items-center justify-center gap-2 px-6 py-3 border-2 border-maasai-red text-maasai-red hover:bg-maasai-red/5 font-semibold rounded-xl transition-colors">
              Create First Listing
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 sm:px-6 py-10">
      <Link href="/profile" className="inline-flex items-center gap-1.5 text-sm text-maasai-beige hover:text-maasai-red transition-colors mb-6">
        <ArrowLeft className="h-4 w-4" /> Back to profile
      </Link>

      {/* Header */}
      <div className="mb-8">
        <div className="w-12 h-12 bg-maasai-red/10 rounded-2xl flex items-center justify-center mb-4">
          <Store className="h-6 w-6 text-maasai-red" />
        </div>
        <h1 className="font-display text-3xl font-bold text-maasai-black dark:text-white mb-2">
          Become a Seller
        </h1>
        <p className="text-maasai-beige text-sm leading-relaxed">
          Join 340+ verified artisans on Maasai Heritage Market. Earn up to 91% of every sale.
        </p>
      </div>

      {/* Perks */}
      <div className="grid grid-cols-3 gap-3 mb-8">
        {[
          { label: 'Commission', value: 'Only 9%' },
          { label: 'Payout', value: 'M-Pesa' },
          { label: 'Support', value: '24/7' },
        ].map(({ label, value }) => (
          <div key={label} className="text-center p-3 rounded-xl bg-maasai-red/5 border border-maasai-red/10">
            <p className="font-bold text-maasai-black dark:text-white text-sm">{value}</p>
            <p className="text-maasai-beige text-xs mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card p-6 space-y-5">

        <div>
          <label className="block text-xs font-semibold text-maasai-beige uppercase tracking-wider mb-1.5">
            Shop / Brand Name <span className="text-maasai-red">*</span>
          </label>
          <div className="relative">
            <Store className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-maasai-beige" />
            <input
              value={form.shop_name}
              onChange={(e) => setForm({ ...form, shop_name: e.target.value })}
              placeholder="e.g. Amara Beadwork"
              className={cn(inputCls, 'pl-10')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maasai-beige uppercase tracking-wider mb-1.5">
            Shop Description <span className="text-maasai-beige/60 font-normal normal-case">(optional)</span>
          </label>
          <div className="relative">
            <FileText className="absolute left-3 top-3.5 h-4 w-4 text-maasai-beige" />
            <textarea
              value={form.shop_description}
              onChange={(e) => setForm({ ...form, shop_description: e.target.value })}
              placeholder="Describe what you sell and your craft story..."
              rows={3}
              className={cn(inputCls, 'pl-10 resize-none')}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-semibold text-maasai-beige uppercase tracking-wider mb-1.5">
            Phone Number <span className="text-maasai-red">*</span>
          </label>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-maasai-beige" />
            <input
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+254 7XX XXX XXX"
              className={cn(inputCls, 'pl-10')}
            />
          </div>
        </div>

        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-maasai-beige/10 dark:bg-maasai-brown-light/30">
          <ShieldCheck className="h-4 w-4 text-maasai-red flex-shrink-0 mt-0.5" />
          <p className="text-xs text-maasai-beige leading-relaxed">
            After registering you can submit your National ID and KRA PIN from the seller dashboard for full verification.
          </p>
        </div>

        <Button
          variant="primary"
          size="lg"
          fullWidth
          loading={submitting}
          onClick={handleSubmit}
        >
          Activate Seller Account
        </Button>
      </div>
    </div>
  );
}
