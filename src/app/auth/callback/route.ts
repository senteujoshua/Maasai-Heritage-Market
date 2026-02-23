import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';

  if (code) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      // Create profile for new OAuth users if one doesn't exist yet
      const { data: existing } = await supabase
        .from('profiles')
        .select('id')
        .eq('id', data.user.id)
        .maybeSingle();

      if (!existing) {
        await supabase.from('profiles').insert({
          id: data.user.id,
          email: data.user.email,
          full_name:
            data.user.user_metadata?.full_name ||
            data.user.user_metadata?.name ||
            '',
          avatar_url: data.user.user_metadata?.avatar_url || null,
          role: 'buyer',
          verification_status: 'not_submitted',
          is_verified: false,
          rating: 0,
          total_sales: 0,
        });
      }

      return NextResponse.redirect(`${origin}${next}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=oauth`);
}
