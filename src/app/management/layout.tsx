import type { ReactNode } from 'react';
import Link from 'next/link';

export default function ManagementLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-maasai-black">
      <header className="bg-maasai-black dark:bg-maasai-brown border-b border-maasai-brown px-6 py-4 flex items-center justify-between">
        <Link href="/management" className="flex items-center gap-2">
          <div className="w-8 h-8 bg-maasai-gradient rounded-full flex items-center justify-center">
            <span className="text-white font-bold text-sm">MH</span>
          </div>
          <div>
            <span className="font-bold text-white text-sm">Maasai Heritage</span>
            <span className="block text-xs text-maasai-terracotta font-medium">Management Portal</span>
          </div>
        </Link>
      </header>
      <main>{children}</main>
    </div>
  );
}
