import { cn } from '@/lib/utils';
import { ShieldCheck, Gavel, Tag, Flame, Archive, Clock, Sparkles } from 'lucide-react';

interface BadgeProps {
  variant?: 'verified' | 'auction' | 'fixed' | 'hot' | 'new' | 'sold' | 'pending' | 'category';
  children: React.ReactNode;
  className?: string;
}

const VARIANT_CONFIG = {
  verified: { cls: 'bg-maasai-red text-white',                            Icon: ShieldCheck },
  auction:  { cls: 'bg-maasai-black text-white',                          Icon: Gavel      },
  fixed:    { cls: 'bg-maasai-beige/30 text-maasai-black border border-maasai-beige', Icon: Tag        },
  hot:      { cls: 'bg-maasai-red text-white animate-bead-pulse',         Icon: Flame      },
  new:      { cls: 'bg-maasai-brown text-white',                          Icon: Sparkles   },
  sold:     { cls: 'bg-maasai-beige/40 text-maasai-brown border border-maasai-beige', Icon: Archive    },
  pending:  { cls: 'bg-amber-100 text-amber-800 border border-amber-200', Icon: Clock      },
  category: { cls: 'bg-maasai-beige/40 text-maasai-brown border border-maasai-beige', Icon: null       },
} as const;

export function Badge({ variant = 'category', children, className }: BadgeProps) {
  const { cls, Icon } = VARIANT_CONFIG[variant];
  return (
    <span className={cn('inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold', cls, className)}>
      {Icon && <Icon className="h-3 w-3 flex-shrink-0" />}
      {children}
    </span>
  );
}

export function VerifiedArtisanBadge({ className }: { className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-maasai-red text-white shadow-sm', className)}>
      <span className="flex h-4 w-4 items-center justify-center rounded-full bg-white/20">
        <ShieldCheck className="h-2.5 w-2.5" />
      </span>
      Verified Artisan
    </span>
  );
}
