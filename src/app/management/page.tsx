'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useUserRole } from '@/hooks/useUserRole';

export default function ManagementIndexPage() {
  const router = useRouter();
  const { isCEO, isManager, isAgent, loading } = useUserRole();

  useEffect(() => {
    if (loading) return;
    if (isCEO) router.replace('/management/admin');
    else if (isManager) router.replace('/management/manager');
    else if (isAgent) router.replace('/management/agent');
    else router.replace('/management/login');
  }, [loading, isCEO, isManager, isAgent, router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-maasai-red border-t-transparent" />
    </div>
  );
}
