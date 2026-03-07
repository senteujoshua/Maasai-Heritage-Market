'use client';
import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { createClient } from '@/lib/supabase/client';
import { ListingForm } from '@/components/seller/ListingForm';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';
import Link from 'next/link';
import type { Listing } from '@/types';

export default function EditListingPage() {
  const { id } = useParams<{ id: string }>();
  const { profile, loading: authLoading } = useAuth();
  const router = useRouter();
  const [listing, setListing] = useState<Listing | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !profile) { router.push('/login'); return; }
  }, [authLoading, profile, router]);

  useEffect(() => {
    if (!profile || !id) return;
    const supabase = createClient();
    supabase
      .from('listings')
      .select(`*, images:listing_images(id, image_url, is_primary, display_order), category:categories(id, name, slug)`)
      .eq('id', id)
      .single()
      .then(({ data, error: err }) => {
        if (err || !data) { setError('Listing not found.'); setLoading(false); return; }
        if (data.seller_id !== profile.id) { setError('You do not own this listing.'); setLoading(false); return; }
        if (data.status === 'sold' || data.status === 'ended') {
          setError('This listing has ended and cannot be edited.');
          setLoading(false);
          return;
        }
        setListing(data as unknown as Listing);
        setLoading(false);
      });
  }, [profile, id]);

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-maasai-red" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-lg mx-auto px-4 py-20 text-center">
        <AlertTriangle className="h-12 w-12 mx-auto text-amber-500 mb-4" />
        <h2 className="text-xl font-bold text-maasai-black dark:text-white mb-2">{error}</h2>
        <Link href="/seller/dashboard" className="text-maasai-red hover:underline text-sm">
          Back to Dashboard
        </Link>
      </div>
    );
  }

  if (!listing) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-6 py-8">
      <div className="mb-6">
        <Link
          href="/seller/dashboard"
          className="inline-flex items-center gap-2 text-sm text-maasai-brown/60 dark:text-maasai-beige/60 hover:text-maasai-red transition-colors mb-3"
        >
          <ArrowLeft className="h-4 w-4" /> Back to Dashboard
        </Link>
        <h1 className="text-2xl font-bold font-display text-maasai-black dark:text-white">Edit Listing</h1>
        <p className="text-sm text-maasai-brown/60 dark:text-maasai-beige/60 mt-1">
          Changes will go back into review before going live.
        </p>
      </div>
      <ListingForm
        sellerId={profile!.id}
        listing={listing}
        onSuccess={() => router.push('/seller/dashboard')}
      />
    </div>
  );
}
