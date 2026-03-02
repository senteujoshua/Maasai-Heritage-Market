'use client';
import { useEffect } from 'react';
import { Button } from '@/components/ui/Button';
import { AlertTriangle } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Global error:', error);
  }, [error]);

  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <AlertTriangle className="h-14 w-14 text-maasai-red mb-4" />
      <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white mb-2">Something went wrong</h1>
      <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm mb-6 max-w-md">
        An unexpected error occurred. Our team has been notified. Please try again.
      </p>
      <div className="flex gap-3">
        <Button variant="primary" onClick={reset}>Try Again</Button>
        <Button variant="outline" onClick={() => window.location.href = '/'}>Go Home</Button>
      </div>
    </div>
  );
}
