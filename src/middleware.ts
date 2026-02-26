import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import type { UserRole } from '@/types';

// ── Route definitions ─────────────────────────────────────────────────────────

/** Any route that requires authentication */
const PROTECTED_ROUTES = [
  '/seller',
  '/admin',
  '/manager',
  '/agent',
  '/checkout',
  '/cart',
  '/profile',
  '/orders',
];

/** Routes accessible only to CEO / admin */
const CEO_ROUTES = ['/admin'];

/** Routes accessible to Manager + CEO */
const MANAGER_ROUTES = ['/manager'];

/** Routes accessible only to Agents */
const AGENT_ROUTES = ['/agent'];

/** Routes only for Sellers (+ staff) */
const SELLER_ROUTES = ['/seller/dashboard', '/seller/listings'];

// ── Helpers ───────────────────────────────────────────────────────────────────

function isCEO(role: UserRole | undefined | null): boolean {
  return role === 'ceo' || role === 'admin'; // 'admin' kept for backwards-compat
}

function isManagerOrAbove(role: UserRole | undefined | null): boolean {
  return isCEO(role) || role === 'manager';
}

// ── Middleware ────────────────────────────────────────────────────────────────

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: Do not run code between createServerClient and supabase.auth.getUser()
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ── 1. Check if route needs auth ────────────────────────────────────────────
  const isProtected = PROTECTED_ROUTES.some((r) => pathname.startsWith(r));

  if (isProtected && !user) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // ── 2. Role-based route enforcement ─────────────────────────────────────────
  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role, town')
      .eq('id', user.id)
      .single();

    const role = profile?.role as UserRole | undefined;

    // /admin/* — CEO / admin only
    if (CEO_ROUTES.some((r) => pathname.startsWith(r))) {
      if (!isCEO(role)) {
        return NextResponse.redirect(new URL('/dashboard?error=ceo_only', request.url));
      }
    }

    // /manager/* — Manager + CEO
    if (MANAGER_ROUTES.some((r) => pathname.startsWith(r))) {
      if (!isManagerOrAbove(role)) {
        return NextResponse.redirect(new URL('/dashboard?error=manager_only', request.url));
      }
    }

    // /agent/* — Agents only
    if (AGENT_ROUTES.some((r) => pathname.startsWith(r))) {
      if (role !== 'agent') {
        return NextResponse.redirect(new URL('/dashboard?error=agent_only', request.url));
      }
    }

    // /seller/* — Seller + staff
    if (SELLER_ROUTES.some((r) => pathname.startsWith(r))) {
      const canAccessSeller = role === 'seller' || isManagerOrAbove(role) || isCEO(role);
      if (!canAccessSeller) {
        return NextResponse.redirect(new URL('/?error=seller_only', request.url));
      }
    }
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|icons|manifest.json|sw.js|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
