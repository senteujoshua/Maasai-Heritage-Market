'use client';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';
import {
  Search, ShoppingCart, Heart, Menu, X, Bell, User, ChevronDown,
  Sun, Moon, Gavel, LayoutDashboard, ShieldAlert, LogOut, Package,
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { createClient } from '@/lib/supabase/client';
import { useCart } from '@/hooks/useCart';
import { cn } from '@/lib/utils';
import type { Profile } from '@/types';

export function Navbar() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [user, setUser] = useState<Profile | null>(null);
  const [scrolled, setScrolled] = useState(false);
  const [mounted, setMounted] = useState(false);
  const { theme, setTheme } = useTheme();
  const supabase = createClient();
  const pathname = usePathname();
  const { items: cartItems } = useCart(user?.id);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setUser(data);
      }
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        const { data } = await supabase.from('profiles').select('*').eq('id', session.user.id).single();
        setUser(data);
      } else setUser(null);
    });
    return () => subscription.unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handler);
    return () => window.removeEventListener('scroll', handler);
  }, []);

  function handleSearch(e: React.FormEvent) {
    e.preventDefault();
    if (query.trim()) window.location.href = `/marketplace?q=${encodeURIComponent(query)}`;
  }

  async function signOut() {
    await supabase.auth.signOut();
    window.location.href = '/';
  }

  const navLinks = [
    { href: '/marketplace', label: 'Marketplace' },
    { href: '/auctions', label: 'Live Auctions', icon: Gavel, live: true },
  ];

  return (
    <nav className={cn(
      'fixed top-0 left-0 right-0 z-40 transition-all duration-300',
      scrolled ? 'bg-white/95 dark:bg-maasai-black/95 backdrop-blur-md shadow-sm' : 'bg-white dark:bg-maasai-black',
      'border-b border-maasai-beige/20 dark:border-maasai-brown/30'
    )}>
      {/* Top banner — rendered client-only so browser extensions can't cause SSR/hydration mismatches */}
      <div className="bg-maasai-black hidden sm:block" style={{ height: '26px' }}>
        {mounted && (
          <p className="text-maasai-beige/80 text-xs py-1.5 text-center tracking-wide">
            Authentic Kenyan Cultural Marketplace · Fast Delivery Across Kenya · M-Pesa Accepted
          </p>
        )}
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Logo */}
          <Link href="/" className="flex-shrink-0 flex items-center gap-2.5">
            <div className="w-9 h-9 bg-maasai-gradient rounded-full flex items-center justify-center shadow-maasai">
              <span className="text-white font-bold text-sm">MH</span>
            </div>
            <div className="hidden sm:block">
              <p className="font-display font-bold text-maasai-black dark:text-white text-base leading-tight">Maasai Heritage</p>
              <p className="text-maasai-terracotta text-[11px] font-medium leading-tight tracking-wide">Market</p>
            </div>
          </Link>

          {/* Search */}
          <form onSubmit={handleSearch} className="hidden md:flex flex-1 max-w-md mx-4">
            <div className="relative w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-maasai-brown/40 dark:text-maasai-beige/40" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shukas, jewelry, art..."
                className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-maasai-cream/50 dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red transition-shadow" />
            </div>
          </form>

          {/* Desktop nav links */}
          <div className="hidden lg:flex items-center gap-1">
            {navLinks.map(({ href, label, icon: Icon, live }) => (
              <Link key={href} href={href}
                className={cn('flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors',
                  pathname === href ? 'bg-maasai-red/10 text-maasai-red' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
                {Icon && <Icon className="h-4 w-4" />}
                {label}
                {live && <span className="flex h-1.5 w-1.5 rounded-full bg-maasai-red animate-bead-pulse" />}
              </Link>
            ))}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5">
            <button onClick={() => setSearchOpen((p) => !p)}
              className="md:hidden p-2 rounded-lg text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 transition-colors">
              <Search className="h-5 w-5" />
            </button>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
              className="hidden sm:flex p-2 rounded-lg text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 transition-colors">
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </button>
            <Link href="/cart"
              className="relative p-2 rounded-lg text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 transition-colors">
              <ShoppingCart className="h-5 w-5" />
              {cartItems.length > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-maasai-red text-white text-[10px] rounded-full min-w-[18px] h-[18px] flex items-center justify-center font-bold px-0.5">
                  {cartItems.length}
                </span>
              )}
            </Link>

            {user ? (
              <div className="relative">
                <button onClick={() => setUserMenuOpen((p) => !p)}
                  className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light transition-colors">
                  <div className="w-8 h-8 rounded-full bg-maasai-gradient flex items-center justify-center text-white text-sm font-bold shadow-sm">
                    {user.full_name?.charAt(0)?.toUpperCase() || 'U'}
                  </div>
                  <ChevronDown className={cn('h-4 w-4 text-maasai-brown dark:text-maasai-beige hidden sm:block transition-transform duration-200', userMenuOpen && 'rotate-180')} />
                </button>

                {userMenuOpen && (
                  <>
                    <div className="fixed inset-0" onClick={() => setUserMenuOpen(false)} />
                    <div className="absolute right-0 top-full mt-2 w-56 bg-white dark:bg-maasai-brown rounded-2xl shadow-2xl border border-maasai-beige/40 dark:border-maasai-brown-light z-50 overflow-hidden">
                      {/* User info */}
                      <div className="px-4 py-3.5 border-b border-maasai-beige/30 dark:border-maasai-brown-light">
                        <p className="font-semibold text-maasai-black dark:text-white text-sm truncate">{user.full_name}</p>
                        <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 capitalize mt-0.5">{user.role}</p>
                      </div>

                      {/* Menu items */}
                      <div className="py-1.5">
                        {[
                          { href: '/profile', Icon: User, label: 'My Profile' },
                          { href: '/wishlist', Icon: Heart, label: 'Wishlist' },
                          { href: '/orders', Icon: Package, label: 'Orders' },
                          { href: '/notifications', Icon: Bell, label: 'Notifications' },
                        ].map(({ href, Icon, label }) => (
                          <Link key={href} href={href} onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light/50 transition-colors">
                            <Icon className="h-4 w-4 text-maasai-brown/60 dark:text-maasai-beige/60" />
                            {label}
                          </Link>
                        ))}

                        {(user.role === 'seller' || user.role === 'admin' || user.role === 'ceo') && (
                          <>
                            <div className="my-1.5 h-px bg-maasai-beige/30 dark:bg-maasai-brown-light mx-4" />
                            <Link href="/seller/dashboard" onClick={() => setUserMenuOpen(false)}
                              className="flex items-center gap-3 px-4 py-2.5 text-sm text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light/50 transition-colors">
                              <LayoutDashboard className="h-4 w-4 text-maasai-brown/60 dark:text-maasai-beige/60" />
                              Seller Dashboard
                            </Link>
                          </>
                        )}

                        {(user.role === 'admin' || user.role === 'ceo') && (
                          <Link href="/admin" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light/50 transition-colors">
                            <ShieldAlert className="h-4 w-4 text-maasai-brown/60 dark:text-maasai-beige/60" />
                            Admin Panel
                          </Link>
                        )}

                        {user.role === 'manager' && (
                          <Link href="/manager" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light/50 transition-colors">
                            <ShieldAlert className="h-4 w-4 text-maasai-brown/60 dark:text-maasai-beige/60" />
                            Manager Dashboard
                          </Link>
                        )}

                        {user.role === 'agent' && (
                          <Link href="/agent" onClick={() => setUserMenuOpen(false)}
                            className="flex items-center gap-3 px-4 py-2.5 text-sm text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light/50 transition-colors">
                            <LayoutDashboard className="h-4 w-4 text-maasai-brown/60 dark:text-maasai-beige/60" />
                            Agent Portal
                          </Link>
                        )}

                        <div className="my-1.5 h-px bg-maasai-beige/30 dark:bg-maasai-brown-light mx-4" />
                        <button onClick={signOut}
                          className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors">
                          <LogOut className="h-4 w-4" />
                          Sign Out
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="hidden sm:flex items-center gap-2">
                <Link href="/login" className="px-4 py-2 text-sm font-medium text-maasai-brown dark:text-maasai-beige hover:text-maasai-red transition-colors">
                  Sign In
                </Link>
                <Link href="/register" className="px-4 py-2 text-sm font-semibold bg-maasai-red hover:bg-maasai-red-dark text-white rounded-xl transition-colors">
                  Join Now
                </Link>
              </div>
            )}

            <button onClick={() => setMobileOpen((p) => !p)}
              className="lg:hidden p-2 rounded-lg text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 transition-colors">
              {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile search expand */}
        {searchOpen && (
          <form onSubmit={handleSearch} className="md:hidden pb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-maasai-brown/50" />
              <input autoFocus value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search shukas, jewelry, art..."
                className="w-full pl-10 pr-4 py-3 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-maasai-cream/50 dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red" />
            </div>
          </form>
        )}

        {/* Mobile menu */}
        {mobileOpen && (
          <div className="lg:hidden border-t border-maasai-beige/30 dark:border-maasai-brown-light py-4 space-y-1">
            {navLinks.map(({ href, label, icon: Icon, live }) => (
              <Link key={href} href={href} onClick={() => setMobileOpen(false)}
                className={cn('flex items-center gap-2.5 px-4 py-3 rounded-xl text-sm font-medium transition-colors',
                  pathname === href ? 'bg-maasai-red/10 text-maasai-red' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
                {Icon && <Icon className="h-4 w-4" />}
                {label}
                {live && <span className="flex h-1.5 w-1.5 rounded-full bg-maasai-red animate-bead-pulse ml-0.5" />}
              </Link>
            ))}
            {!user && (
              <div className="pt-3 flex flex-col gap-2">
                <Link href="/login" className="block text-center py-2.5 text-sm font-semibold text-maasai-red border border-maasai-red rounded-xl">
                  Sign In
                </Link>
                <Link href="/register" className="block text-center py-2.5 text-sm font-semibold bg-maasai-red text-white rounded-xl">
                  Join Now — Free
                </Link>
              </div>
            )}
          </div>
        )}
      </div>
    </nav>
  );
}
