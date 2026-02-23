import Link from 'next/link';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/server';
import { ProductCard } from '@/components/marketplace/ProductCard';
import { formatKES } from '@/lib/utils';
import { ArrowRight, ShieldCheck, Truck, CreditCard, Star, Users, Package } from 'lucide-react';
import type { Listing } from '@/types';

const CATEGORIES = [
  { name: 'Drawings & Art', slug: 'drawings-art', icon: '🎨', color: 'from-amber-500 to-orange-600', desc: 'Original paintings & prints' },
  { name: 'Beaded Jewelry', slug: 'beaded-jewelry', icon: '📿', color: 'from-red-600 to-rose-700', desc: 'Handcrafted necklaces & bracelets' },
  { name: 'Attire & Clothing', slug: 'attire-clothing', icon: '👘', color: 'from-blue-500 to-blue-700', desc: 'Traditional & fusion fashion' },
  { name: 'Shukas & Textiles', slug: 'shukas-textiles', icon: '🧣', color: 'from-red-800 to-gray-900', desc: 'Authentic Maasai shukas' },
  { name: 'Cultural Tools', slug: 'cultural-tools', icon: '🪘', color: 'from-yellow-600 to-amber-700', desc: 'Traditional instruments & tools' },
  { name: 'Home Décor', slug: 'home-decor', icon: '🏺', color: 'from-emerald-600 to-teal-700', desc: 'African-inspired home pieces' },
];

async function getFeaturedData() {
  const supabase = await createClient();
  const [auctionsRes, featuredRes] = await Promise.all([
    supabase.from('listings').select(`*, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary), category:categories(name, slug)`)
      .eq('status', 'active').eq('listing_type', 'auction').eq('is_approved', true)
      .gt('auction_end_time', new Date().toISOString()).order('auction_end_time', { ascending: true }).limit(4),
    supabase.from('listings').select(`*, seller:profiles(full_name, shop_name, is_verified), images:listing_images(image_url, is_primary), category:categories(name, slug)`)
      .eq('status', 'active').eq('listing_type', 'fixed').eq('is_approved', true)
      .order('views', { ascending: false }).limit(8),
  ]);
  return { auctions: auctionsRes.data || [], featured: featuredRes.data || [] };
}

export default async function HomePage() {
  const { auctions, featured } = await getFeaturedData();

  return (
    <div className="animate-fade-in">
      {/* HERO */}
      <section className="relative min-h-[85vh] flex items-center overflow-hidden bg-maasai-black">
        <div className="absolute inset-0">
          <Image src="https://images.unsplash.com/photo-1590735213920-68192a487bc2?w=1920&h=1080&fit=crop&q=80" alt="Maasai marketplace" fill priority className="object-cover opacity-40" />
          <div className="hero-overlay absolute inset-0" />
        </div>
        <div className="absolute inset-0 opacity-5 bg-shuka-pattern" />
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-20 sm:py-32">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 bg-maasai-red/20 border border-maasai-red/40 rounded-full px-4 py-2 mb-6">
              <ShieldCheck className="h-4 w-4 text-maasai-ochre" />
              <span className="text-maasai-ochre text-sm font-medium">Kenya&apos;s #1 Cultural Marketplace</span>
            </div>
            <h1 className="font-display text-4xl sm:text-5xl lg:text-6xl font-bold text-white leading-tight mb-6">
              Authentic Kenyan{' '}
              <span className="gradient-text">Culture</span>{' '}
              <br className="hidden sm:block" />In Your Hands
            </h1>
            <p className="text-maasai-beige/90 text-lg sm:text-xl leading-relaxed mb-8 max-w-xl">
              Handcrafted shukas, beaded jewelry, and traditional art — directly from Maasai artisans across Kenya. Every piece has a story.
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Link href="/marketplace" className="inline-flex items-center justify-center gap-2 px-8 py-4 bg-maasai-red hover:bg-maasai-red-dark text-white font-bold rounded-2xl shadow-maasai transition-all hover:scale-105 text-base">
                Shop Now <ArrowRight className="h-5 w-5" />
              </Link>
              <Link href="/auctions" className="inline-flex items-center justify-center gap-2 px-8 py-4 border-2 border-maasai-beige/60 text-maasai-beige hover:bg-maasai-beige/10 font-bold rounded-2xl transition-all text-base">
                🔔 Live Auctions
                {auctions.length > 0 && (
                  <span className="bg-maasai-red text-white text-xs px-2 py-0.5 rounded-full font-bold animate-bead-pulse">{auctions.length}</span>
                )}
              </Link>
            </div>
            <div className="flex flex-wrap gap-6 mt-10">
              {[{ value: '2,400+', label: 'Artisan Listings', icon: Package }, { value: '340+', label: 'Verified Artisans', icon: ShieldCheck }, { value: '18K+', label: 'Happy Buyers', icon: Users }].map(({ value, label, icon: Icon }) => (
                <div key={label} className="flex items-center gap-2">
                  <Icon className="h-4 w-4 text-maasai-ochre" />
                  <div>
                    <p className="text-white font-bold text-lg leading-none">{value}</p>
                    <p className="text-maasai-beige/70 text-xs">{label}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="absolute bottom-0 left-0 right-0">
          <svg viewBox="0 0 1440 60" fill="none" className="w-full">
            <path d="M0 60L1440 60L1440 30C1200 0 960 60 720 30C480 0 240 60 0 30L0 60Z" fill="#FDF6E3" className="dark:fill-[#1A0F00]" />
          </svg>
        </div>
      </section>

      {/* LIVE AUCTIONS */}
      {auctions.length > 0 && (
        <section className="section-container">
          <div className="flex items-center justify-between mb-8">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="flex h-2.5 w-2.5 rounded-full bg-maasai-red animate-bead-pulse" />
                <span className="text-maasai-red text-sm font-bold uppercase tracking-wider">Live Now</span>
              </div>
              <h2 className="section-title">Ending Soon Auctions</h2>
            </div>
            <Link href="/auctions" className="hidden sm:flex items-center gap-1.5 text-maasai-red font-semibold hover:gap-2.5 transition-all text-sm">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {auctions.map((listing: Listing) => <ProductCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      )}

      {/* CATEGORIES */}
      <section className="section-container">
        <div className="text-center mb-10">
          <h2 className="section-title mb-3">Browse by Category</h2>
          <p className="text-maasai-brown/70 dark:text-maasai-beige/70 max-w-xl mx-auto">
            From hand-beaded jewelry to traditional shukas — discover Kenya&apos;s rich cultural heritage
          </p>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
          {CATEGORIES.map((cat) => (
            <Link key={cat.slug} href={`/marketplace?category=${cat.slug}`}
              className="group flex flex-col items-center p-4 rounded-2xl bg-white dark:bg-maasai-brown border border-maasai-beige/40 dark:border-maasai-brown-light hover:border-maasai-red shadow-card hover:shadow-card-hover transition-all duration-300 hover:-translate-y-1">
              <div className={`w-14 h-14 bg-gradient-to-br ${cat.color} rounded-2xl flex items-center justify-center text-2xl mb-3 group-hover:scale-110 transition-transform`}>
                {cat.icon}
              </div>
              <p className="font-semibold text-maasai-black dark:text-white text-sm text-center leading-tight">{cat.name}</p>
              <p className="text-maasai-brown/50 dark:text-maasai-beige/50 text-xs text-center mt-0.5 hidden sm:block">{cat.desc}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* FEATURED PRODUCTS */}
      {featured.length > 0 && (
        <section className="section-container bg-maasai-beige/10 dark:bg-maasai-brown/20 rounded-3xl mx-4 sm:mx-6">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="section-title">Featured Items</h2>
              <p className="text-maasai-brown/60 dark:text-maasai-beige/60 mt-1">Handpicked by our cultural curators</p>
            </div>
            <Link href="/marketplace" className="hidden sm:flex items-center gap-1.5 text-maasai-red font-semibold text-sm">
              View All <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {featured.map((listing: Listing) => <ProductCard key={listing.id} listing={listing} />)}
          </div>
        </section>
      )}

      {/* HOW IT WORKS */}
      <section className="section-container">
        <div className="text-center mb-10">
          <h2 className="section-title mb-3">How It Works</h2>
          <p className="text-maasai-brown/70 dark:text-maasai-beige/70">Simple, secure, and authentically Kenyan</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {[
            { step: '01', icon: '🔍', title: 'Browse & Discover', desc: 'Explore authentic Kenyan cultural items. Filter by category, region, or find live auctions.' },
            { step: '02', icon: '🔔', title: 'Bid or Buy Now', desc: 'Join 6–12 hour auctions or purchase immediately. All items include cultural backstories.' },
            { step: '03', icon: '📱', title: 'Pay with M-Pesa', desc: 'Pay via M-Pesa STK Push, debit card, or Cash on Delivery. All transactions are protected.' },
            { step: '04', icon: '🚚', title: 'Fast Delivery', desc: 'Ships via G4S or Aramex Kenya. Track your order in real time.' },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="text-center p-6 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light shadow-card">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-maasai-red/10 text-3xl mb-4">{icon}</div>
              <div className="text-xs font-bold text-maasai-red mb-1 tracking-wider uppercase">Step {step}</div>
              <h3 className="font-bold text-maasai-black dark:text-white mb-2">{title}</h3>
              <p className="text-sm text-maasai-brown/70 dark:text-maasai-beige/70 leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* SELLER CTA */}
      <section className="section-container">
        <div className="relative bg-maasai-gradient rounded-3xl overflow-hidden p-8 sm:p-12 text-white">
          <div className="absolute inset-0 bg-shuka-pattern opacity-5" />
          <div className="relative grid lg:grid-cols-2 gap-8 items-center">
            <div>
              <h2 className="font-display text-3xl sm:text-4xl font-bold mb-4">Are You a Kenyan Artisan?</h2>
              <p className="text-white/80 text-lg mb-6 leading-relaxed">
                Join 340+ verified artisans selling authentic cultural crafts. Earn up to 91% of every sale.
              </p>
              <div className="flex flex-col sm:flex-row gap-3">
                <Link href="/register?role=seller" className="inline-flex items-center justify-center gap-2 px-7 py-3.5 bg-white text-maasai-red font-bold rounded-xl hover:bg-maasai-cream transition-colors">
                  Start Selling Free <ArrowRight className="h-5 w-5" />
                </Link>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              {[
                { label: 'Commission', value: 'Only 9%', icon: '💰' },
                { label: 'Payout', value: 'Weekly M-Pesa', icon: '📱' },
                { label: 'Support', value: '24/7 SMS Help', icon: '🎧' },
                { label: 'Reach', value: 'All of Kenya', icon: '🇰🇪' },
              ].map(({ label, value, icon }) => (
                <div key={label} className="bg-white/10 backdrop-blur-sm rounded-xl p-4">
                  <span className="text-2xl">{icon}</span>
                  <p className="font-bold text-white mt-1">{value}</p>
                  <p className="text-white/70 text-xs mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* TRUST BADGES */}
      <section className="bg-white dark:bg-maasai-brown border-y border-maasai-beige/40 dark:border-maasai-brown-light py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: ShieldCheck, title: 'Verified Artisans', desc: 'National ID & KRA PIN verified', color: 'text-maasai-blue' },
              { icon: CreditCard, title: 'Secure Payments', desc: 'M-Pesa STK Push & card', color: 'text-green-600' },
              { icon: Truck, title: 'Tracked Delivery', desc: 'G4S & Aramex Kenya', color: 'text-maasai-terracotta' },
              { icon: Star, title: 'Buyer Protection', desc: '7-day return guarantee', color: 'text-maasai-gold' },
            ].map(({ icon: Icon, title, desc, color }) => (
              <div key={title} className="flex items-center gap-3">
                <div className={`p-2.5 rounded-xl bg-maasai-beige/20 dark:bg-maasai-brown-light/30 ${color}`}>
                  <Icon className="h-6 w-6" />
                </div>
                <div>
                  <p className="font-semibold text-sm text-maasai-black dark:text-white">{title}</p>
                  <p className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60">{desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>
    </div>
  );
}
