import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Returns a browser-side Supabase client.
 *
 * NOTE: @supabase/ssr 0.5.x has a known type mismatch where the returned
 * client's .auth is typed as an internal SupabaseAuthClient that omits methods
 * like getSession, signInWithOAuth, signInWithPassword, etc.  Casting to the
 * canonical SupabaseClient from @supabase/supabase-js restores correct types.
 */
export function createClient(): SupabaseClient {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  ) as unknown as SupabaseClient;
}
