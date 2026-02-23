import type { Metadata, Viewport } from 'next';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from 'next-themes';
import { Navbar } from '@/components/layout/Navbar';
import { Footer } from '@/components/layout/Footer';
import './globals.css';

export const metadata: Metadata = {
  title: {
    default: 'Maasai Heritage Market — Authentic Kenyan Cultural Marketplace',
    template: '%s | Maasai Heritage Market',
  },
  description: 'Shop authentic Maasai and Kenyan cultural art, handcrafted jewelry, shukas, and traditional crafts. Live auctions every day. Verified artisans across Kenya.',
  keywords: ['Maasai', 'Kenya', 'cultural art', 'handmade jewelry', 'shuka', 'African crafts', 'marketplace'],
  manifest: '/manifest.json',
  other: {
    'apple-mobile-web-app-capable': 'yes',
    'apple-mobile-web-app-status-bar-style': 'black-translucent',
    'apple-mobile-web-app-title': 'MaasaiMkt',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#B22222' },
    { media: '(prefers-color-scheme: dark)', color: '#1A0F00' },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <script
          dangerouslySetInnerHTML={{
            __html: `if('serviceWorker'in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('/sw.js'))}`,
          }}
        />
      </head>
      <body>
        <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1 pt-20 sm:pt-[4.5rem]">{children}</main>
            <Footer />
          </div>
          <Toaster
            position="top-right"
            toastOptions={{
              duration: 4000,
              style: {
                background: '#2F1F0F',
                color: '#FDF6E3',
                border: '1px solid #4A3020',
                borderRadius: '12px',
                fontFamily: 'Poppins, sans-serif',
                fontSize: '14px',
              },
              success: { iconTheme: { primary: '#B22222', secondary: '#FDF6E3' } },
            }}
          />
        </ThemeProvider>
      </body>
    </html>
  );
}
