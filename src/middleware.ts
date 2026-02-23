import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';

const protectedRoutes = ['/seller', '/admin', '/checkout', '/cart', '/profile', '/orders'];
const sellerOnlyRoutes = ['/seller/dashboard', '/seller/listings'];
const adminOnlyRoutes = ['/admin'];

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
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

  const { data: { user } } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;
  const isProtected = protectedRoutes.some((r) => pathname.startsWith(r));

  if (isProtected && !user) {
    const url = new URL('/login', request.url);
    url.searchParams.set('redirect', pathname);
    return NextResponse.redirect(url);
  }

  if (user && isProtected) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile) {
      const isSellerRoute = sellerOnlyRoutes.some((r) => pathname.startsWith(r));
      const isAdminRoute = adminOnlyRoutes.some((r) => pathname.startsWith(r));
      if (isSellerRoute && profile.role !== 'seller' && profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/?error=seller_only', request.url));
      }
      if (isAdminRoute && profile.role !== 'admin') {
        return NextResponse.redirect(new URL('/?error=admin_only', request.url));
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
