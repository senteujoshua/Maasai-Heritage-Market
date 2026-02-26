import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase.auth as any).getUser();

  if (!user) redirect('/login?redirect=/manager');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowed = ['admin', 'ceo', 'manager'];
  if (!profile || !allowed.includes(profile.role)) {
    redirect('/dashboard?error=manager_only');
  }

  return <>{children}</>;
}
