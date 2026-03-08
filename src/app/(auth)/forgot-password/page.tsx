'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Mail, ArrowLeft, Loader2, CheckCircle } from 'lucide-react';
import toast from 'react-hot-toast';

const schema = z.object({
  email: z.string().email('Enter a valid email'),
});
type FormData = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    const redirectTo = `${window.location.origin}/auth/callback?next=/reset-password`;
    const { error } = await supabase.auth.resetPasswordForEmail(data.email, { redirectTo });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      setSent(true);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-maasai-cream dark:bg-maasai-black p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="inline-flex items-center gap-3 mb-6">
            <div className="w-12 h-12 bg-maasai-gradient rounded-full flex items-center justify-center shadow-maasai">
              <span className="text-white font-bold text-lg">MH</span>
            </div>
            <div className="text-left">
              <p className="font-display font-bold text-xl text-maasai-black dark:text-white leading-tight">Maasai Heritage</p>
              <p className="text-maasai-terracotta text-sm font-medium">Market</p>
            </div>
          </Link>
          <h1 className="text-2xl font-bold text-maasai-black dark:text-white">Forgot password?</h1>
          <p className="text-maasai-brown/70 dark:text-maasai-beige/70 mt-1 text-sm">
            We&apos;ll send a reset link to your email
          </p>
        </div>

        <div className="bg-white dark:bg-maasai-brown rounded-3xl shadow-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-8">
          {sent ? (
            <div className="text-center py-4">
              <CheckCircle className="h-14 w-14 text-green-500 mx-auto mb-4" />
              <h2 className="text-lg font-bold text-maasai-black dark:text-white mb-2">Check your inbox</h2>
              <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mb-6">
                If that email is registered, you&apos;ll receive a password reset link shortly.
              </p>
              <Link href="/login" className="text-sm text-maasai-red font-semibold hover:underline inline-flex items-center gap-1">
                <ArrowLeft className="h-4 w-4" /> Back to sign in
              </Link>
            </div>
          ) : (
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
              <div>
                <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                  <input
                    type="email"
                    placeholder="you@email.com"
                    autoComplete="email"
                    {...register('email')}
                    className="w-full pl-11 pr-4 py-3.5 rounded-xl border-2 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maasai-red transition-colors placeholder:text-maasai-brown/40 border-maasai-beige dark:border-maasai-brown-light focus:border-maasai-red"
                  />
                </div>
                {errors.email && <p className="text-red-500 text-xs mt-1.5">{errors.email.message}</p>}
              </div>

              <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
                Send reset link
              </Button>

              <div className="text-center">
                <Link href="/login" className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red inline-flex items-center gap-1 transition-colors">
                  <ArrowLeft className="h-4 w-4" /> Back to sign in
                </Link>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
