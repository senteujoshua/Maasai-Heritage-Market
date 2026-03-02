import { createServerClient } from '@supabase/ssr';
import type { CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { SupabaseClient } from '@supabase/supabase-js';

// Guard: ensure the admin client never runs in a browser bundle.
if (typeof window !== 'undefined') {
  throw new Error('lib/supabase/server must only be imported in server-side code.');
}

/**
 * Server-side Supabase client (uses anon key + cookie session).
 *
 * Same casting rationale as client.ts — @supabase/ssr 0.5.x internal types
 * omit standard GoTrueClient auth methods; casting restores them.
 */
export async function createClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* ignore in Server Components */ }
        },
      },
    }
  ) as unknown as SupabaseClient;
}

/**
 * Admin Supabase client (uses service role key — bypasses RLS).
 * NEVER import this from 'use client' files.
 */
export async function createAdminClient(): Promise<SupabaseClient> {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch { /* ignore */ }
        },
      },
    }
  ) as unknown as SupabaseClient;
}
