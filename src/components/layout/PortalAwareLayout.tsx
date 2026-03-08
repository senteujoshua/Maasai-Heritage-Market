'use client';
import { usePathname } from 'next/navigation';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';

const PORTAL_PREFIXES = ['/vendor', '/management'];

export function PortalAwareLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isPortal = PORTAL_PREFIXES.some((prefix) => pathname.startsWith(prefix));

  if (isPortal) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Navbar />
      <main className="flex-1 pt-20 sm:pt-[4.5rem]">{children}</main>
      <Footer />
    </div>
  );
}
