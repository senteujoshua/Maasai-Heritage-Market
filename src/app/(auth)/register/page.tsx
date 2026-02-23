'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Mail, Lock, User, Phone, ShieldCheck, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';

const GoogleIcon = () => (
  <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden="true">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
  </svg>
);
import { cn } from '@/lib/utils';
import type { UserRole } from '@/types';

const schema = z.object({
  full_name: z.string().min(3, 'Enter your full name').max(100),
  email: z.string().email('Enter a valid email'),
  phone: z.string().min(7, 'Enter a valid phone number').max(16, 'Enter a valid phone number').regex(/^\+?[1-9]\d{5,14}$/, 'Enter a valid phone number (e.g. +1 555 0000000)'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirm_password: z.string(),
  role: z.enum(['buyer', 'seller']),
  shop_name: z.string().optional(),
  agree_terms: z.literal(true, { errorMap: () => ({ message: 'You must agree to the terms' }) }),
}).refine((d) => d.password === d.confirm_password, { message: 'Passwords do not match', path: ['confirm_password'] });

type FormData = z.infer<typeof schema>;

export default function RegisterPage() {
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const defaultRole = (searchParams.get('role') || 'buyer') as UserRole;
  const supabase = createClient();

  const { register, handleSubmit, watch, formState: { errors } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: { role: defaultRole as 'buyer' | 'seller', agree_terms: true },
  });
  const selectedRole = watch('role');

  async function signUpWithGoogle() {
    setGoogleLoading(true);
    const callbackUrl = `${window.location.origin}/auth/callback?next=/`;
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: callbackUrl },
    });
    if (error) {
      toast.error(error.message);
      setGoogleLoading(false);
    }
  }

  async function onSubmit(data: FormData) {
    setLoading(true);
    try {
      const { data: authData, error: signUpError } = await supabase.auth.signUp({
        email: data.email,
        password: data.password,
        options: { data: { full_name: data.full_name, phone: data.phone, role: data.role } },
      });
      if (signUpError) throw signUpError;
      if (authData.user) {
        await supabase.from('profiles').upsert({
          id: authData.user.id, email: data.email, full_name: data.full_name, phone: data.phone,
          role: data.role, shop_name: data.role === 'seller' ? data.shop_name || null : null,
          verification_status: 'not_submitted', is_verified: false, rating: 0, total_sales: 0,
        });
      }
      toast.success('Account created! Check your email to verify.');
      router.push('/login');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Registration failed';
      toast.error(message.includes('already registered') ? 'Email already registered' : message);
    } finally {
      setLoading(false);
    }
  }

  const inputCls = (hasError: boolean) => cn(
    'w-full pl-11 pr-4 py-3.5 rounded-xl border-2 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-maasai-red transition-colors placeholder:text-maasai-brown/40',
    hasError ? 'border-red-400' : 'border-maasai-beige dark:border-maasai-brown-light focus:border-maasai-red'
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-maasai-cream dark:bg-maasai-black p-4 py-10">
      <div className="w-full max-w-lg">
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
          <h1 className="text-2xl font-bold text-maasai-black dark:text-white">Create your account</h1>
          <p className="text-maasai-brown/70 dark:text-maasai-beige/70 mt-1 text-sm">Join Kenya&apos;s cultural marketplace</p>
        </div>
        <div className="bg-white dark:bg-maasai-brown rounded-3xl shadow-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-8">
          <button
            type="button"
            onClick={signUpWithGoogle}
            disabled={googleLoading}
            className="w-full flex items-center justify-center gap-3 py-3.5 px-4 rounded-xl border-2 border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm font-semibold hover:border-maasai-red hover:bg-maasai-red/5 transition-all disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {googleLoading ? (
              <svg className="h-5 w-5 animate-spin text-maasai-red" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
              </svg>
            ) : (
              <GoogleIcon />
            )}
            Continue with Google
          </button>
          <p className="text-center text-xs text-maasai-brown/50 dark:text-maasai-beige/50 mt-2">
            Signs you up as a Buyer — you can upgrade to Seller in your profile
          </p>

          <div className="flex items-center gap-3 my-5">
            <div className="flex-1 h-px bg-maasai-beige dark:bg-maasai-brown-light" />
            <span className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 font-medium">or register with email</span>
            <div className="flex-1 h-px bg-maasai-beige dark:bg-maasai-brown-light" />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label className="block text-sm font-bold text-maasai-black dark:text-white mb-3 uppercase tracking-wider">I am a...</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { value: 'buyer', label: 'Buyer', desc: 'Shop authentic crafts' },
                  { value: 'seller', label: 'Artisan / Seller', desc: 'Sell my creations' },
                ].map(({ value, label, desc }) => (
                  <label key={value} className={cn('flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all', selectedRole === value ? 'border-maasai-red bg-maasai-red/5' : 'border-maasai-beige dark:border-maasai-brown-light hover:border-maasai-red/50')}>
                    <input type="radio" value={value} {...register('role')} className="sr-only" />
                    <span className="font-bold text-sm text-maasai-black dark:text-white">{label}</span>
                    <span className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">{desc}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Full Name</label>
              <div className="relative">
                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input {...register('full_name')} placeholder="Your full name" className={inputCls(!!errors.full_name)} />
              </div>
              {errors.full_name && <p className="text-red-500 text-xs mt-1">{errors.full_name.message}</p>}
            </div>
            {selectedRole === 'seller' && (
              <div>
                <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Shop / Brand Name <span className="text-xs font-normal text-maasai-brown/60">(optional)</span></label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xl">🏪</span>
                  <input {...register('shop_name')} placeholder="e.g., Amara Crafts" className={inputCls(false)} />
                </div>
              </div>
            )}
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Email Address</label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input type="email" {...register('email')} placeholder="you@email.com" className={inputCls(!!errors.email)} />
              </div>
              {errors.email && <p className="text-red-500 text-xs mt-1">{errors.email.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Phone Number</label>
              <div className="relative">
                <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input {...register('phone')} placeholder="+1 555 000 0000" className={inputCls(!!errors.phone)} />
              </div>
              {errors.phone && <p className="text-red-500 text-xs mt-1">{errors.phone.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input type={showPassword ? 'text' : 'password'} {...register('password')} placeholder="Min. 8 characters" className={cn(inputCls(!!errors.password), 'pr-12')} />
                <button type="button" onClick={() => setShowPassword((p) => !p)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-maasai-brown/50">
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
              {errors.password && <p className="text-red-500 text-xs mt-1">{errors.password.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Confirm Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 h-5 w-5 text-maasai-brown/50" />
                <input type="password" {...register('confirm_password')} placeholder="Repeat password" className={inputCls(!!errors.confirm_password)} />
              </div>
              {errors.confirm_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_password.message}</p>}
            </div>
            <label className="flex items-start gap-3 cursor-pointer">
              <input type="checkbox" {...register('agree_terms')} className="mt-0.5 w-4 h-4 accent-maasai-red rounded" />
              <span className="text-sm text-maasai-brown/80 dark:text-maasai-beige/80">
                I agree to the <Link href="/terms" className="text-maasai-red hover:underline">Terms</Link> and <Link href="/privacy" className="text-maasai-red hover:underline">Privacy Policy</Link> (KDPA 2019)
              </span>
            </label>
            {errors.agree_terms && <p className="text-red-500 text-xs -mt-2">{errors.agree_terms.message}</p>}
            <Button type="submit" variant="primary" size="lg" fullWidth loading={loading}>Create Account</Button>
          </form>
          <p className="text-center text-sm text-maasai-brown/70 dark:text-maasai-beige/70 mt-6">
            Already have an account? <Link href="/login" className="text-maasai-red font-semibold hover:underline">Sign in</Link>
          </p>
          <div className="mt-5 flex items-center justify-center gap-1.5 text-xs text-maasai-brown/50 dark:text-maasai-beige/50">
            <ShieldCheck className="h-3.5 w-3.5" /> Protected under Kenya Data Protection Act 2019
          </div>
        </div>
      </div>
    </div>
  );
}
