import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import type { UserRole } from '@/types';

// ── Route definitions ─────────────────────────────────────────────────────────

const BUYER_PROTECTED = ['/checkout', '/cart', '/profile', '/orders', '/wishlist', '/notifications', '/messages'];
const VENDOR_ROUTES = ['/vendor/dashboard', '/vendor/listings', '/vendor/register'];
const MANAGEMENT_ROUTES = ['/management/admin', '/management/manager', '/management/agent'];

// Legacy routes → redirect to new paths
const LEGACY_REDIRECTS: Record<string, string> = {
  '/seller/dashboard': '/vendor/dashboard',
  '/seller/listings': '/vendor/listings',
  '/seller/register': '/vendor/register',
  '/admin': '/management/admin',
  '/manager': '/management/manager',
  '/agent': '/management/agent',
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCEO(role: UserRole | undefined | null): boolean {
  return role === 'ceo' || role === 'admin';
}
function isManagerOrAbove(role: UserRole | undefined | null): boolean {
  return isCEO(role) || role === 'manager';
}
function isManagementRole(role: UserRole | undefined | null): boolean {
  return isCEO(role) || role === 'manager' || role === 'agent';
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });
  const pathname = request.nextUrl.pathname;

  // ── 0. Legacy redirects ──────────────────────────────────────────────────────
  for (const [oldPath, newPath] of Object.entries(LEGACY_REDIRECTS)) {
    if (pathname === oldPath || pathname.startsWith(oldPath + '/')) {
      const newUrl = new URL(pathname.replace(oldPath, newPath), request.url);
      newUrl.search = request.nextUrl.search;
      return NextResponse.redirect(newUrl);
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();

  // ── 1. Buyer protected routes ────────────────────────────────────────────────
  if (BUYER_PROTECTED.some((r) => pathname.startsWith(r))) {
    if (!user) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('redirect', pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  // ── 2. Vendor portal ─────────────────────────────────────────────────────────
  const isVendorRoute = VENDOR_ROUTES.some((r) => pathname.startsWith(r));
  if (isVendorRoute) {
    if (!user) {
      return NextResponse.redirect(new URL(`/vendor/login?redirect=${encodeURIComponent(pathname)}`, request.url));
    }
    let role = user.app_metadata?.role as UserRole | undefined;
    if (!role) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      role = profile?.role as UserRole | undefined;
    }
    const canAccessVendor = role === 'seller' || isManagerOrAbove(role) || isCEO(role);
    if (!canAccessVendor) {
      return NextResponse.redirect(new URL('/vendor/login?error=seller_only', request.url));
    }
  }

  // ── 3. Management portal ─────────────────────────────────────────────────────
  const isManagementRoute = pathname.startsWith('/management') && !pathname.startsWith('/management/login');
  if (isManagementRoute) {
    if (!user) {
      return NextResponse.redirect(new URL(`/management/login?redirect=${encodeURIComponent(pathname)}`, request.url));
    }
    let role = user.app_metadata?.role as UserRole | undefined;
    if (!role) {
      const { data: profile } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      role = profile?.role as UserRole | undefined;
    }
    if (!isManagementRole(role)) {
      return NextResponse.redirect(new URL('/management/login?error=access_denied', request.url));
    }
    // Sub-route enforcement
    if (pathname.startsWith('/management/admin') && !isCEO(role)) {
      return NextResponse.redirect(new URL('/management?error=ceo_only', request.url));
    }
    if (pathname.startsWith('/management/manager') && !isManagerOrAbove(role)) {
      return NextResponse.redirect(new URL('/management?error=manager_only', request.url));
    }
    if (pathname.startsWith('/management/agent') && role !== 'agent') {
      return NextResponse.redirect(new URL('/management?error=agent_only', request.url));
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
