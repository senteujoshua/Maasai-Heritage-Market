'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ListingForm } from '@/components/seller/ListingForm';
import { Loader2, ArrowLeft } from 'lucide-react';
import Link from 'next/link';

export default function NewListingPage() {
  const { profile, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !profile) router.push('/login');
    if (!loading && profile && profile.role !== 'seller') router.push('/register?role=seller');
  }, [profile, loading, router]);

  if (loading) {
    return <div className="flex items-center justify-center min-h-[60vh]"><Loader2 className="h-8 w-8 animate-spin text-maasai-red" /></div>;
  }

  if (!profile) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link href="/seller/dashboard" className="inline-flex items-center gap-2 text-sm text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red transition-colors mb-3">
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">Create New Listing</h1>
        <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mt-1">Fill in the details about your cultural item. All listings are reviewed before going live.</p>
      </div>
      <ListingForm sellerId={profile.id} />
    </div>
  );
}
