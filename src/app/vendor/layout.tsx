import type { ReactNode } from 'react';
import Link from 'next/link';

export default function VendorLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-maasai-cream dark:bg-maasai-black">
      <header className="bg-white dark:bg-maasai-brown border-b border-maasai-beige dark:border-maasai-brown-light px-6 py-4 flex items-center justify-between">
        <Link href="/vendor/dashboard" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-maasai-gradient rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">MH</span>
          </div>
          <div>
            <span className="font-bold text-maasai-black dark:text-white text-sm">Maasai Heritage</span>
            <span className="block text-xs text-maasai-terracotta font-medium">Vendor Portal</span>
          </div>
        </Link>
        <Link href="/" className="text-xs text-maasai-brown/60 hover:text-maasai-red transition-colors">
          ← Back to marketplace
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
