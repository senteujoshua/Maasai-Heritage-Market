'use client';
import { cn } from '@/lib/utils';
import { CATEGORIES, KENYAN_REGIONS, type SearchFilters } from '@/types';
import { SlidersHorizontal, X, ChevronDown, ChevronUp } from 'lucide-react';
import { useState } from 'react';

interface CategoryFilterProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  className?: string;
}

export function CategoryFilter({ filters, onChange, className }: CategoryFilterProps) {
  const [priceOpen, setPriceOpen] = useState(true);
  const [regionOpen, setRegionOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function update(key: keyof SearchFilters, value: unknown) { onChange({ ...filters, [key]: value }); }
  function clearAll() { onChange({ query: filters.query }); }

  const hasActiveFilters = !!(filters.category || filters.listing_type || filters.min_price || filters.max_price || filters.region);

  const FilterContent = () => (
    <div className="space-y-6">
      {hasActiveFilters && (
        <button onClick={clearAll} className="flex items-center gap-1.5 text-sm text-maasai-red hover:underline font-medium">
          <X className="h-3.5 w-3.5" /> Clear all filters
        </button>
      )}
      <div>
        <h3 className="text-sm font-bold text-maasai-black dark:text-white uppercase tracking-wider mb-3">Category</h3>
        <div className="space-y-1.5">
          <button onClick={() => update('category', undefined)}
            className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', !filters.category ? 'bg-maasai-red text-white font-semibold' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat.slug} onClick={() => update('category', cat.slug)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors flex items-center gap-2', filters.category === cat.slug ? 'bg-maasai-red text-white font-semibold' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
              <span>{cat.icon}</span>{cat.name}
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 className="text-sm font-bold text-maasai-black dark:text-white uppercase tracking-wider mb-3">Listing Type</h3>
        <div className="space-y-1.5">
          {[{ value: undefined, label: 'All' }, { value: 'auction', label: '🔔 Live Auctions' }, { value: 'fixed', label: '🏷️ Buy Now' }].map(({ value, label }) => (
            <button key={label} onClick={() => update('listing_type', value)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', filters.listing_type === value ? 'bg-maasai-red text-white font-semibold' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
              {label}
            </button>
          ))}
        </div>
      </div>
      <div>
        <button onClick={() => setPriceOpen((p) => !p)} className="flex items-center justify-between w-full text-sm font-bold text-maasai-black dark:text-white uppercase tracking-wider mb-3">
          Price Range (KES) {priceOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {priceOpen && (
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mb-1 block">Min</label>
              <input type="number" placeholder="0" value={filters.min_price || ''}
                onChange={(e) => update('min_price', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-sm text-maasai-black dark:text-white focus:outline-none focus:ring-2 focus:ring-maasai-red" />
            </div>
            <div>
              <label className="text-xs text-maasai-brown/60 dark:text-maasai-beige/60 mb-1 block">Max</label>
              <input type="number" placeholder="Any" value={filters.max_price || ''}
                onChange={(e) => update('max_price', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2 rounded-lg border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-sm text-maasai-black dark:text-white focus:outline-none focus:ring-2 focus:ring-maasai-red" />
            </div>
          </div>
        )}
      </div>
      <div>
        <button onClick={() => setRegionOpen((p) => !p)} className="flex items-center justify-between w-full text-sm font-bold text-maasai-black dark:text-white uppercase tracking-wider mb-3">
          Region {regionOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
        {regionOpen && (
          <div className="space-y-1.5">
            <button onClick={() => update('region', undefined)}
              className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', !filters.region ? 'bg-maasai-red text-white font-semibold' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
              All Regions
            </button>
            {KENYAN_REGIONS.map((region) => (
              <button key={region} onClick={() => update('region', region)}
                className={cn('w-full text-left px-3 py-2 rounded-lg text-sm transition-colors', filters.region === region ? 'bg-maasai-red text-white font-semibold' : 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30')}>
                {region}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <>
      <div className={cn('hidden lg:block', className)}>
        <div className="sticky top-24 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light p-5">
          <div className="flex items-center gap-2 mb-5">
            <SlidersHorizontal className="h-5 w-5 text-maasai-red" />
            <h2 className="font-bold text-maasai-black dark:text-white">Filters</h2>
            {hasActiveFilters && <span className="ml-auto bg-maasai-red text-white text-xs rounded-full px-2 py-0.5 font-semibold">Active</span>}
          </div>
          <FilterContent />
        </div>
      </div>
      <div className="lg:hidden fixed bottom-4 left-4 z-30">
        <button onClick={() => setMobileOpen(true)} className="flex items-center gap-2 bg-maasai-red text-white px-4 py-2.5 rounded-full shadow-maasai font-semibold text-sm">
          <SlidersHorizontal className="h-4 w-4" /> Filters
          {hasActiveFilters && <span className="bg-white text-maasai-red text-xs rounded-full px-1.5 py-0.5 font-bold">!</span>}
        </button>
      </div>
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-white dark:bg-maasai-brown h-full overflow-y-auto p-5">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-maasai-black dark:text-white text-lg">Filters</h2>
              <button onClick={() => setMobileOpen(false)}><X className="h-6 w-6" /></button>
            </div>
            <FilterContent />
          </div>
        </div>
      )}
    </>
  );
}
