import { cn } from '@/lib/utils';
import { ShieldCheck } from 'lucide-react';

interface BadgeProps {
  variant?: 'verified' | 'auction' | 'fixed' | 'hot' | 'new' | 'sold' | 'pending' | 'category';
  children: React.ReactNode;
  className?: string;
}

export function Badge({ variant = 'category', children, className }: BadgeProps) {
  const variants = {
    verified: 'bg-maasai-blue text-white border border-maasai-blue-dark',
    auction: 'bg-maasai-terracotta text-white',
    fixed: 'bg-green-600 text-white',
    hot: 'bg-maasai-red text-white animate-bead-pulse',
    new: 'bg-maasai-ochre text-white',
    sold: 'bg-gray-600 text-white',
    pending: 'bg-yellow-500 text-maasai-black',
    category: 'bg-maasai-beige/40 text-maasai-brown border border-maasai-beige',
  };
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', variants[variant], className)}>
      {variant === 'verified' && <ShieldCheck className="h-3 w-3" />}
      {children}
    </span>
  );
}

export function VerifiedArtisanBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-maasai-blue text-white border-2 border-maasai-blue-light shadow-sm', className)}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
        <ShieldCheck className="h-2.5 w-2.5" />
      </span>
      Verified Maasai Artisan
    </span>
  );
}
