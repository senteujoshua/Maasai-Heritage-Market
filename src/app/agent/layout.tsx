import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export default async function AgentLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: { user } } = await (supabase.auth as any).getUser();

  if (!user) redirect('/login?redirect=/agent');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();

  if (!profile || profile.role !== 'agent') {
    redirect('/dashboard?error=agent_only');
  }

  return <>{children}</>;
}
