'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Lock, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

const schema = z.object({
  password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm: z.string(),
}).refine((d) => d.password === d.confirm, {
  message: 'Passwords do not match',
  path: ['confirm'],
});
type FormData = z.infer<typeof schema>;

export default function ResetPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const { register, handleSubmit, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
  });

  async function onSubmit(data: FormData) {
    setLoading(true);
    const { error } = await supabase.auth.updateUser({ password: data.password });
    setLoading(false);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Password updated! Please sign in.');
      router.push('/login');
    }
  }

  const inputCls = (hasError: boolean) => cn(
    'w-full pl-11 pr-12 py-3.5 rounded-xl border-2 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maasai-red transition-colors placeholder:text-maasai-brown/40',
    hasError ? 'border-red-400' : 'border-maasai-beige dark:border-maasai-brown-light focus:border-maasai-red'
  );

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
          <h1 className="text-2xl font-bold text-maasai-black dark:text-white">Set new password</h1>
          <p className="text-maasai-brown/70 dark:text-maasai-beige/70 mt-1 text-sm">
            Choose a strong password for your account
          </p>
        </div>

        <div className="bg-white dark:bg-maasai-brown rounded-3xl shadow-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-8">
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">
                New Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="At least 6 characters"
                  autoComplete="new-password"
                  {...register('password')}
                  className={inputCls(!!errors.password)}
                />
                <button type="button" onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-maasai-brown/50 hover:text-maasai-brown transition-colors">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1.5">{errors.password.message}</p>}
            </div>

            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  placeholder="Repeat your password"
                  autoComplete="new-password"
                  {...register('confirm')}
                  className={inputCls(!!errors.confirm)}
                />
                <button type="button" onClick={() => setShowConfirm((p) => !p)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-maasai-brown/50 hover:text-maasai-brown transition-colors">
                  {showConfirm ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.confirm && <p className="text-red-500 text-xs mt-1.5">{errors.confirm.message}</p>}
            </div>

            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>
              Update password
            </Button>

            <div className="text-center">
              <Link href="/login" className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red transition-colors">
                Back to sign in
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
