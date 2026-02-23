import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';
import { formatDistanceToNow, format, differenceInSeconds } from 'date-fns';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatKES(amount: number): string {
  return new Intl.NumberFormat('en-KE', {
    style: 'currency',
    currency: 'KES',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatDate(dateString: string): string {
  return format(new Date(dateString), 'dd MMM yyyy');
}

export function formatDateTime(dateString: string): string {
  return format(new Date(dateString), 'dd MMM yyyy, HH:mm');
}

export function timeAgo(dateString: string): string {
  return formatDistanceToNow(new Date(dateString), { addSuffix: true });
}

export function getTimeRemaining(endTime: string): {
  hours: number;
  minutes: number;
  seconds: number;
  total: number;
  isExpired: boolean;
} {
  const total = differenceInSeconds(new Date(endTime), new Date());
  if (total <= 0) return { hours: 0, minutes: 0, seconds: 0, total: 0, isExpired: true };
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  return { hours, minutes, seconds, total, isExpired: false };
}

export function getAuctionUrgency(endTime: string): 'critical' | 'urgent' | 'normal' | 'ended' {
  const { total, isExpired } = getTimeRemaining(endTime);
  if (isExpired) return 'ended';
  if (total < 1800) return 'critical'; // < 30 min
  if (total < 7200) return 'urgent';   // < 2 hours
  return 'normal';
}

export function calculateCommission(amount: number, rate = 0.09) {
  const commission = Math.round(amount * rate);
  return { commission, sellerAmount: amount - commission };
}

export function generateOrderId(): string {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `MHM-${timestamp}-${random}`;
}

export function sanitizePhone(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  if (cleaned.startsWith('0')) return '254' + cleaned.slice(1);
  if (cleaned.startsWith('+254')) return cleaned.slice(1);
  if (cleaned.startsWith('254')) return cleaned;
  return cleaned;
}

export function truncate(str: string, length: number): string {
  if (str.length <= length) return str;
  return str.slice(0, length) + '…';
}

export function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}
