import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function ManagerLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as any).getUser();

  if (!user) redirect('/management/login?redirect=/management/manager');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  const allowed = ['admin', 'ceo', 'manager'];
  if (!profile || !allowed.includes(profile.role)) {
    redirect('/management/login?error=manager_only');
  }

  return <>{children}</>;
}
