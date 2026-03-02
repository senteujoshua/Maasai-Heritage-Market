import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Package } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <div className="w-24 h-24 bg-maasai-beige/20 rounded-full flex items-center justify-center mb-6">
        <Package className="h-12 w-12 text-maasai-beige" />
      </div>
      <h1 className="text-5xl font-bold font-display text-maasai-red mb-2">404</h1>
      <h2 className="text-xl font-semibold text-maasai-black dark:text-white mb-3">Page not found</h2>
      <p className="text-maasai-brown/60 dark:text-maasai-beige/60 text-sm mb-8 max-w-md">
        The page you&apos;re looking for doesn&apos;t exist or has been moved.
      </p>
      <div className="flex gap-3">
        <Link href="/marketplace">
          <Button variant="primary">Browse Marketplace</Button>
        </Link>
        <Link href="/">
          <Button variant="outline">Go Home</Button>
        </Link>
      </div>
    </div>
  );
}
