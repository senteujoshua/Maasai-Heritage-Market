'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/Button';
import { formatKES } from '@/lib/utils';
import { TrendingUp, Info } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BidFormProps {
  listingId: string;
  currentBid: number | null;
  startingBid: number | null;
  userId: string | null;
  onBid: (amount: number) => Promise<void>;
  isExpired: boolean;
}

const MIN_INCREMENT = 100;

export function BidForm({ currentBid, startingBid, userId, onBid, isExpired }: BidFormProps) {
  const [bidding, setBidding] = useState(false);
  const minBid = (currentBid || startingBid || 0) + MIN_INCREMENT;

  const schema = z.object({
    amount: z.number({ invalid_type_error: 'Enter a valid amount' }).min(minBid, `Minimum bid is ${formatKES(minBid)}`),
  });

  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm<{ amount: number }>({
    resolver: zodResolver(schema),
    defaultValues: { amount: minBid },
  });

  const watchedAmount = watch('amount');
  const quickBids = [minBid, minBid + 500, minBid + 1000, minBid + 2500];

  async function onSubmit({ amount }: { amount: number }) {
    if (!userId) return;
    setBidding(true);
    try { await onBid(amount); reset({ amount: amount + MIN_INCREMENT }); }
    finally { setBidding(false); }
  }

  if (isExpired) return (
    <div className="rounded-xl bg-gray-100 dark:bg-gray-800 p-4 text-center">
      <p className="text-gray-500 font-medium">This auction has ended</p>
    </div>
  );

  if (!userId) return (
    <div className="rounded-xl border-2 border-maasai-beige p-4 text-center">
      <p className="text-maasai-brown dark:text-maasai-beige mb-3">Sign in to place a bid</p>
      <Button variant="primary" onClick={() => window.location.href = '/login'}>Sign In to Bid</Button>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-1.5 text-xs text-maasai-brown/70 dark:text-maasai-beige/70">
        <Info className="h-3.5 w-3.5" />
        Minimum increment: {formatKES(MIN_INCREMENT)}
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quickBids.map((amount) => (
          <button key={amount} type="button" onClick={() => onBid(amount).catch(console.error)} disabled={bidding}
            className={cn('py-2 px-3 rounded-lg border-2 text-sm font-semibold transition-all border-maasai-beige hover:border-maasai-red hover:bg-maasai-red hover:text-white text-maasai-brown dark:text-maasai-beige dark:border-maasai-brown disabled:opacity-50')}>
            {formatKES(amount)}
          </button>
        ))}
      </div>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-3">
        <div>
          <label className="block text-sm font-medium text-maasai-brown dark:text-maasai-beige mb-1.5">Custom Bid (KES)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-maasai-brown/50 font-semibold">KES</span>
            <input type="number" step="50" min={minBid}
              {...register('amount', { valueAsNumber: true })}
              className={cn('w-full pl-12 pr-4 py-3 rounded-lg border-2 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white font-semibold text-lg focus:outline-none focus:ring-2 focus:ring-maasai-red', errors.amount ? 'border-red-500' : 'border-maasai-beige dark:border-maasai-brown-light')} />
          </div>
          {errors.amount && <p className="text-red-500 text-xs mt-1">{errors.amount.message}</p>}
        </div>
        <Button type="submit" variant="primary" size="lg" fullWidth loading={bidding}>
          <TrendingUp className="h-5 w-5" />
          Place Bid — {watchedAmount ? formatKES(Number(watchedAmount)) : formatKES(minBid)}
        </Button>
      </form>
    </div>
  );
}
