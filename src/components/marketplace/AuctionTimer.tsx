'use client';
import { useEffect, useState } from 'react';
import { Clock, Flame, AlertTriangle } from 'lucide-react';
import { getTimeRemaining, getAuctionUrgency } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { formatKES } from '@/lib/utils';

interface AuctionTimerProps {
  endTime: string;
  onExpired?: () => void;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

export function AuctionTimer({ endTime, onExpired, size = 'md', showIcon = true, className }: AuctionTimerProps) {
  const [timeLeft, setTimeLeft] = useState(getTimeRemaining(endTime));

  useEffect(() => {
    if (timeLeft.isExpired) { onExpired?.(); return; }
    const interval = setInterval(() => {
      const remaining = getTimeRemaining(endTime);
      setTimeLeft(remaining);
      if (remaining.isExpired) { onExpired?.(); clearInterval(interval); }
    }, 1000);
    return () => clearInterval(interval);
  }, [endTime, onExpired, timeLeft.isExpired]);

  const urgency = getAuctionUrgency(endTime);

  if (timeLeft.isExpired) {
    return (
      <span className={cn('inline-flex items-center gap-1 text-gray-500 font-medium', className)}>
        {showIcon && <Clock className="h-4 w-4" />} Auction Ended
      </span>
    );
  }

  const sizeCls = { sm: 'text-sm gap-1', md: 'text-base gap-1.5', lg: 'text-xl gap-2' };
  const urgencyCls = {
    critical: 'text-red-600 animate-bead-pulse font-bold',
    urgent: 'text-maasai-terracotta font-semibold',
    normal: 'text-maasai-brown font-medium',
    ended: 'text-gray-500',
  };
  const Icon = urgency === 'critical' ? Flame : urgency === 'urgent' ? AlertTriangle : Clock;
  const pad = (n: number) => n.toString().padStart(2, '0');

  return (
    <span className={cn('inline-flex items-center', sizeCls[size], urgencyCls[urgency], className)}>
      {showIcon && <Icon className={cn('flex-shrink-0', size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-5 w-5')} />}
      <span className="font-mono tabular-nums">
        {timeLeft.hours > 0 && <>{pad(timeLeft.hours)}:</>}
        {pad(timeLeft.minutes)}:{pad(timeLeft.seconds)}
      </span>
    </span>
  );
}

interface AuctionTimerCardProps {
  endTime: string;
  currentBid: number | null;
  startingBid: number | null;
  bidCount: number;
  onExpired?: () => void;
}

export function AuctionTimerCard({ endTime, currentBid, startingBid, bidCount, onExpired }: AuctionTimerCardProps) {
  const urgency = getAuctionUrgency(endTime);
  const borderCls = {
    critical: 'border-red-500 bg-red-50 dark:bg-red-950/20',
    urgent: 'border-maasai-terracotta bg-orange-50 dark:bg-orange-950/20',
    normal: 'border-maasai-beige bg-maasai-cream dark:bg-maasai-brown/20',
    ended: 'border-gray-300 bg-gray-50',
  };
  return (
    <div className={cn('rounded-xl border-2 p-4', borderCls[urgency])}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs font-semibold uppercase tracking-wider text-maasai-brown/70 dark:text-maasai-beige/70">
          Time Remaining
        </span>
        <AuctionTimer endTime={endTime} onExpired={onExpired} size="md" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div>
          <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mb-0.5">
            {currentBid ? 'Current Bid' : 'Starting Bid'}
          </p>
          <p className="text-xl font-bold text-maasai-black dark:text-white">
            {formatKES(currentBid || startingBid || 0)}
          </p>
        </div>
        <div>
          <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mb-0.5">Total Bids</p>
          <p className="text-xl font-bold text-maasai-black dark:text-white">{bidCount}</p>
        </div>
      </div>
    </div>
  );
}
