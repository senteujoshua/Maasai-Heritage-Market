'use client';
import { useState, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { formatKES } from '@/lib/utils';
import { Upload, X, Plus, ImageIcon, Info } from 'lucide-react';
import toast from 'react-hot-toast';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import type { Listing, KenyanRegion } from '@/types';
import { KENYAN_REGIONS, CATEGORIES } from '@/types';

const schema = z.object({
  title: z.string().min(5, 'Title must be at least 5 characters').max(120),
  description: z.string().min(20, 'Please provide a detailed description').max(2000),
  cultural_story: z.string().max(1000).optional(),
  price: z.coerce.number().min(50, 'Minimum price is KES 50'),
  listing_type: z.enum(['fixed', 'auction']),
  auction_duration: z.coerce.number().min(6).max(24).optional(),
  starting_bid: z.coerce.number().min(50).optional(),
  category_id: z.string().min(1, 'Select a category'),
  condition: z.enum(['new', 'like_new', 'good', 'fair']).optional(),
  region: z.string().optional() as z.ZodType<KenyanRegion | undefined>,
  quantity: z.coerce.number().min(1).max(100),
  tags: z.string().optional(),
}).refine((d) => d.listing_type !== 'auction' || (d.starting_bid && d.starting_bid >= 50), {
  message: 'Enter a starting bid for auctions',
  path: ['starting_bid'],
});

type FormData = z.infer<typeof schema>;

interface Props {
  sellerId: string;
  listing?: Listing;
  onSuccess?: () => void;
}

export function ListingForm({ sellerId, listing, onSuccess }: Props) {
  const router = useRouter();
  const [images, setImages] = useState<File[]>([]);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [existingImages, setExistingImages] = useState<Array<{id: string; image_url: string; is_primary: boolean}>>(
    (listing?.images as Array<{id: string; image_url: string; is_primary: boolean}>) || []
  );
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [categories, setCategories] = useState<Array<{id: string; name: string; slug: string}>>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    resolver: zodResolver(schema),
    defaultValues: {
      title: listing?.title || '',
      description: listing?.description || '',
      cultural_story: listing?.cultural_story || '',
      price: listing?.price || 0,
      listing_type: listing?.listing_type || 'fixed',
      auction_duration: 12,
      starting_bid: listing?.starting_bid || 0,
      category_id: (listing?.category as Record<string, unknown>)?.id as string || '',
      condition: (listing?.condition as 'new' | 'like_new' | 'good' | 'fair') || 'new',
      region: listing?.region as KenyanRegion,
      quantity: listing?.quantity || 1,
      tags: listing?.tags?.join(', ') || '',
    },
  });

  const listingType = watch('listing_type');

  const loadCategories = useCallback(async () => {
    if (categoriesLoaded) return;
    const supabase = createClient();
    const { data } = await supabase.from('categories').select('id, name, slug').order('name');
    setCategories(data || []);
    setCategoriesLoaded(true);
  }, [categoriesLoaded]);

  function handleImageSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []);
    const totalImages = images.length + existingImages.length;
    const allowed = Math.min(files.length, 8 - totalImages);
    if (allowed <= 0) { toast.error('Maximum 8 images allowed'); return; }
    const newFiles = files.slice(0, allowed);
    const newPreviews = newFiles.map((f) => URL.createObjectURL(f));
    setImages((prev) => [...prev, ...newFiles]);
    setImagePreviews((prev) => [...prev, ...newPreviews]);
  }

  function removeNewImage(index: number) {
    URL.revokeObjectURL(imagePreviews[index]);
    setImages((prev) => prev.filter((_, i) => i !== index));
    setImagePreviews((prev) => prev.filter((_, i) => i !== index));
    if (primaryIndex >= existingImages.length + index) setPrimaryIndex(0);
  }

  function removeExistingImage(index: number) {
    setExistingImages((prev) => prev.filter((_, i) => i !== index));
    if (primaryIndex === index) setPrimaryIndex(0);
  }

  async function uploadImages(listingId: string): Promise<string[]> {
    const supabase = createClient();
    const urls: string[] = [];
    for (const file of images) {
      const ext = file.name.split('.').pop();
      const path = `${sellerId}/${listingId}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from('listing-images').upload(path, file, { upsert: true });
      if (!error) {
        const { data: urlData } = supabase.storage.from('listing-images').getPublicUrl(path);
        urls.push(urlData.publicUrl);
      }
    }
    return urls;
  }

  async function onSubmit(data: FormData) {
    if (images.length === 0 && existingImages.length === 0) {
      toast.error('Please add at least one image');
      return;
    }
    setUploading(true);
    try {
      const supabase = createClient();
      const auctionEndTime = data.listing_type === 'auction'
        ? new Date(Date.now() + (data.auction_duration || 12) * 60 * 60 * 1000).toISOString()
        : null;

      const listingPayload = {
        seller_id: sellerId,
        title: data.title,
        description: data.description,
        cultural_story: data.cultural_story || null,
        price: data.listing_type === 'auction' ? (data.starting_bid || data.price) : data.price,
        starting_bid: data.listing_type === 'auction' ? data.starting_bid : null,
        current_bid: data.listing_type === 'auction' ? (data.starting_bid || data.price) : null,
        listing_type: data.listing_type,
        auction_end_time: auctionEndTime,
        category_id: data.category_id,
        condition: data.condition || 'new',
        region: data.region || null,
        quantity: data.quantity,
        tags: data.tags ? data.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        status: 'active',
        is_approved: false,
      };

      let listingId = listing?.id;
      if (listing?.id) {
        const { error } = await supabase.from('listings').update(listingPayload).eq('id', listing.id);
        if (error) throw error;
      } else {
        const { data: newListing, error } = await supabase.from('listings').insert(listingPayload).select().single();
        if (error) throw error;
        listingId = newListing.id;
      }

      // Upload new images
      const newUrls = await uploadImages(listingId!);
      const allImages = [
        ...existingImages,
        ...newUrls.map((url) => ({ id: '', image_url: url, is_primary: false })),
      ];

      // Delete removed existing images
      if (listing?.id) {
        const removedIds = ((listing?.images as Array<{id: string}>) || [])
          .filter((img) => !existingImages.find((e) => e.id === img.id))
          .map((img) => img.id);
        if (removedIds.length) {
          await supabase.from('listing_images').delete().in('id', removedIds);
        }
      }

      // Upsert new image records
      const imageRecords = newUrls.map((url, i) => ({
        listing_id: listingId,
        image_url: url,
        is_primary: existingImages.length === 0 && i === primaryIndex - existingImages.length,
      }));
      if (imageRecords.length > 0) {
        await supabase.from('listing_images').insert(imageRecords);
      }

      // Update primary flag on existing images
      if (existingImages.length > 0 && primaryIndex < existingImages.length) {
        const primaryId = existingImages[primaryIndex].id;
        await supabase.from('listing_images').update({ is_primary: false }).eq('listing_id', listingId);
        await supabase.from('listing_images').update({ is_primary: true }).eq('id', primaryId);
      }

      toast.success(listing?.id ? 'Listing updated! Awaiting admin approval.' : 'Listing submitted! Awaiting admin approval.');
      onSuccess ? onSuccess() : router.push('/seller/dashboard');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Failed to save listing';
      toast.error(message);
    } finally {
      setUploading(false);
    }
  }

  const inputCls = (hasError: boolean) => cn(
    'w-full px-4 py-3 rounded-xl border-2 bg-white dark:bg-maasai-brown text-maasai-black dark:text-white text-sm focus:outline-none focus:ring-2 focus:ring-maasai-red transition-colors',
    hasError ? 'border-red-400' : 'border-maasai-beige dark:border-maasai-brown-light focus:border-maasai-red'
  );

  const totalImages = existingImages.length + images.length;

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-8">
      {/* IMAGES */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-6">
        <h2 className="font-bold text-maasai-black dark:text-white mb-1 flex items-center gap-2">
          <ImageIcon className="h-5 w-5 text-maasai-red" /> Product Images
        </h2>
        <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mb-4">Upload up to 8 images. Click to set primary image.</p>
        <div className="grid grid-cols-4 gap-3">
          {existingImages.map((img, i) => (
            <div key={img.id} onClick={() => setPrimaryIndex(i)}
              className={cn('relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-colors', primaryIndex === i ? 'border-maasai-red' : 'border-transparent')}>
              <img src={img.image_url} alt="" className="w-full h-full object-cover" />
              {primaryIndex === i && <div className="absolute top-1 left-1 bg-maasai-red text-white text-xs px-1.5 py-0.5 rounded-full font-bold">Primary</div>}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeExistingImage(i); }}
                className="absolute top-1 right-1 w-6 h-6 bg-maasai-black/60 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          ))}
          {imagePreviews.map((preview, i) => (
            <div key={i} onClick={() => setPrimaryIndex(existingImages.length + i)}
              className={cn('relative aspect-square rounded-xl overflow-hidden cursor-pointer border-2 transition-colors', primaryIndex === existingImages.length + i ? 'border-maasai-red' : 'border-transparent')}>
              <img src={preview} alt="" className="w-full h-full object-cover" />
              {primaryIndex === existingImages.length + i && <div className="absolute top-1 left-1 bg-maasai-red text-white text-xs px-1.5 py-0.5 rounded-full font-bold">Primary</div>}
              <button type="button" onClick={(e) => { e.stopPropagation(); removeNewImage(i); }}
                className="absolute top-1 right-1 w-6 h-6 bg-maasai-black/60 rounded-full flex items-center justify-center hover:bg-red-600 transition-colors">
                <X className="h-3.5 w-3.5 text-white" />
              </button>
            </div>
          ))}
          {totalImages < 8 && (
            <label className="aspect-square rounded-xl border-2 border-dashed border-maasai-beige dark:border-maasai-brown-light hover:border-maasai-red cursor-pointer flex flex-col items-center justify-center gap-1 text-maasai-brown/50 hover:text-maasai-red transition-colors">
              <Plus className="h-7 w-7" />
              <span className="text-xs font-medium">Add Photo</span>
              <input type="file" accept="image/*" multiple className="sr-only" onChange={handleImageSelect} />
            </label>
          )}
        </div>
      </div>

      {/* BASIC INFO */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-6 space-y-4">
        <h2 className="font-bold text-maasai-black dark:text-white">Basic Information</h2>
        <div>
          <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Title *</label>
          <input {...register('title')} placeholder="e.g., Handwoven Maasai Shuka — Authentic Red & Blue" className={inputCls(!!errors.title)} />
          {errors.title && <p className="text-red-500 text-xs mt-1">{errors.title.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Description *</label>
          <textarea {...register('description')} rows={4} placeholder="Describe your item in detail — materials, size, how it was made..." className={cn(inputCls(!!errors.description), 'resize-none')} />
          {errors.description && <p className="text-red-500 text-xs mt-1">{errors.description.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1 flex items-center gap-1.5">
            Cultural Story <span className="text-maasai-brown/50 font-normal text-xs">(optional)</span>
          </label>
          <p className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 mb-1.5 flex items-start gap-1">
            <Info className="h-3.5 w-3.5 flex-shrink-0 mt-0.5" /> Share the cultural significance, tradition, or story behind this piece
          </p>
          <textarea {...register('cultural_story')} rows={3} placeholder="e.g., This shuka pattern has been woven by my family for generations in Kajiado..." className={cn(inputCls(false), 'resize-none')} />
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Category *</label>
            <select {...register('category_id')} onFocus={loadCategories} className={inputCls(!!errors.category_id)}>
              <option value="">Select a category...</option>
              {categories.map((cat) => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
              {!categoriesLoaded && CATEGORIES.map((cat) => <option key={cat.slug} value={cat.slug}>{cat.name}</option>)}
            </select>
            {errors.category_id && <p className="text-red-500 text-xs mt-1">{errors.category_id.message}</p>}
          </div>
          <div>
            <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Condition</label>
            <select {...register('condition')} className={inputCls(false)}>
              <option value="new">New</option>
              <option value="like_new">Like New</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Region</label>
            <select {...register('region')} className={inputCls(false)}>
              <option value="">Select region...</option>
              {KENYAN_REGIONS.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Quantity</label>
            <input type="number" min={1} max={100} {...register('quantity')} className={inputCls(!!errors.quantity)} />
          </div>
        </div>
        <div>
          <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Tags <span className="text-maasai-brown/50 font-normal text-xs">(comma separated)</span></label>
          <input {...register('tags')} placeholder="e.g., handmade, beaded, traditional, jewelry" className={inputCls(false)} />
        </div>
      </div>

      {/* PRICING */}
      <div className="bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/30 dark:border-maasai-brown-light p-6 space-y-4">
        <h2 className="font-bold text-maasai-black dark:text-white">Pricing & Listing Type</h2>
        <div>
          <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-2">Listing Type *</label>
          <div className="grid grid-cols-2 gap-3">
            {[
              { value: 'fixed', label: '🏷️ Fixed Price', desc: 'Set a price, sell immediately' },
              { value: 'auction', label: '🔔 Auction', desc: '6–24 hour timed bidding' },
            ].map(({ value, label, desc }) => (
              <label key={value} className={cn('flex flex-col p-4 rounded-xl border-2 cursor-pointer transition-all', listingType === value ? 'border-maasai-red bg-maasai-red/5' : 'border-maasai-beige dark:border-maasai-brown-light hover:border-maasai-red/40')}>
                <input type="radio" value={value} {...register('listing_type')} className="sr-only" />
                <span className="font-bold text-sm text-maasai-black dark:text-white">{label}</span>
                <span className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mt-0.5">{desc}</span>
              </label>
            ))}
          </div>
        </div>

        {listingType === 'fixed' ? (
          <div>
            <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Price (KES) *</label>
            <div className="relative">
              <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-maasai-brown/60">KES</span>
              <input type="number" min={50} {...register('price')} placeholder="0" className={cn(inputCls(!!errors.price), 'pl-14')} />
            </div>
            {errors.price && <p className="text-red-500 text-xs mt-1">{errors.price.message}</p>}
          </div>
        ) : (
          <div className="grid sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Starting Bid (KES) *</label>
              <div className="relative">
                <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-bold text-maasai-brown/60">KES</span>
                <input type="number" min={50} {...register('starting_bid')} placeholder="0" className={cn(inputCls(!!errors.starting_bid), 'pl-14')} />
              </div>
              {errors.starting_bid && <p className="text-red-500 text-xs mt-1">{errors.starting_bid.message}</p>}
            </div>
            <div>
              <label className="block text-sm font-semibold text-maasai-brown dark:text-maasai-beige mb-1.5">Auction Duration (hours)</label>
              <select {...register('auction_duration')} className={inputCls(false)}>
                {[6, 8, 12, 16, 24].map((h) => <option key={h} value={h}>{h} hours</option>)}
              </select>
            </div>
          </div>
        )}

        <div className="bg-maasai-beige/10 dark:bg-maasai-brown-light/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-maasai-black dark:text-white mb-1">Commission: 9%</p>
          <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">You keep 91% of every sale. Weekly payout via M-Pesa.</p>
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" size="lg" onClick={() => router.back()} className="flex-1">Cancel</Button>
        <Button type="submit" variant="primary" size="lg" loading={isSubmitting || uploading} className="flex-1">
          {uploading ? 'Uploading...' : listing?.id ? 'Update Listing' : 'Submit Listing'}
        </Button>
      </div>
    </form>
  );
}
