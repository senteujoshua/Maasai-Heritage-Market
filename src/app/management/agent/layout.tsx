import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const { data: { user } } = await (supabase.auth as any).getUser();

  if (!user) redirect('/management/login?redirect=/management/agent');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'agent') {
    redirect('/management/login?error=agent_only');
  }

  return <>{children}</>;
}
