'use client';
import { cn } from '@/lib/utils';
import { CATEGORIES, KENYAN_REGIONS, type SearchFilters } from '@/types';
import { SlidersHorizontal, X, ChevronDown, ChevronUp, Gavel, Tag, LayoutGrid } from 'lucide-react';
import { useState } from 'react';

interface CategoryFilterProps {
  filters: SearchFilters;
  onChange: (filters: SearchFilters) => void;
  className?: string;
}

const LISTING_TYPES = [
  { value: undefined, label: 'All Types', Icon: LayoutGrid },
  { value: 'auction', label: 'Live Auctions', Icon: Gavel },
  { value: 'fixed', label: 'Buy Now', Icon: Tag },
] as const;

export function CategoryFilter({ filters, onChange, className }: CategoryFilterProps) {
  const [priceOpen, setPriceOpen] = useState(true);
  const [regionOpen, setRegionOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function update(key: keyof SearchFilters, value: unknown) { onChange({ ...filters, [key]: value }); }
  function clearAll() { onChange({ query: filters.query }); }

  const hasActiveFilters = !!(filters.category || filters.listing_type || filters.min_price || filters.max_price || filters.region);

  const sectionLabel = 'block text-[11px] font-bold text-maasai-brown/50 dark:text-maasai-beige/40 uppercase tracking-widest mb-3';
  const optionBase = 'w-full text-left px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150';
  const optionActive = 'bg-maasai-red text-white shadow-sm';
  const optionIdle = 'text-maasai-brown dark:text-maasai-beige hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light/40';

  const FilterContent = () => (
    <div className="space-y-7">
      {hasActiveFilters && (
        <button onClick={clearAll} className="flex items-center gap-1.5 text-sm text-maasai-red hover:text-maasai-red-dark font-semibold transition-colors">
          <X className="h-3.5 w-3.5" /> Clear all filters
        </button>
      )}

      {/* Category */}
      <div>
        <span className={sectionLabel}>Category</span>
        <div className="space-y-1">
          <button onClick={() => update('category', undefined)}
            className={cn(optionBase, !filters.category ? optionActive : optionIdle)}>
            All Categories
          </button>
          {CATEGORIES.map((cat) => (
            <button key={cat.slug} onClick={() => update('category', cat.slug)}
              className={cn(optionBase, filters.category === cat.slug ? optionActive : optionIdle)}>
              {cat.name}
            </button>
          ))}
        </div>
      </div>

      {/* Listing Type */}
      <div>
        <span className={sectionLabel}>Listing Type</span>
        <div className="space-y-1">
          {LISTING_TYPES.map(({ value, label, Icon }) => (
            <button key={label} onClick={() => update('listing_type', value)}
              className={cn(optionBase, 'flex items-center gap-2.5', filters.listing_type === value ? optionActive : optionIdle)}>
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Price Range */}
      <div>
        <button onClick={() => setPriceOpen((p) => !p)}
          className="flex items-center justify-between w-full mb-3 group">
          <span className={sectionLabel + ' mb-0'}>Price Range (KES)</span>
          {priceOpen
            ? <ChevronUp className="h-4 w-4 text-maasai-brown/40 group-hover:text-maasai-red transition-colors" />
            : <ChevronDown className="h-4 w-4 text-maasai-brown/40 group-hover:text-maasai-red transition-colors" />}
        </button>
        {priceOpen && (
          <div className="grid grid-cols-2 gap-2.5">
            <div>
              <label className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 mb-1.5 block font-medium">Min</label>
              <input type="number" placeholder="0" value={filters.min_price || ''}
                onChange={(e) => update('min_price', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2.5 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-sm text-maasai-black dark:text-white focus:outline-none focus:ring-2 focus:ring-maasai-red transition-shadow" />
            </div>
            <div>
              <label className="text-xs text-maasai-brown/50 dark:text-maasai-beige/50 mb-1.5 block font-medium">Max</label>
              <input type="number" placeholder="Any" value={filters.max_price || ''}
                onChange={(e) => update('max_price', e.target.value ? Number(e.target.value) : undefined)}
                className="w-full px-3 py-2.5 rounded-xl border border-maasai-beige dark:border-maasai-brown-light bg-white dark:bg-maasai-brown text-sm text-maasai-black dark:text-white focus:outline-none focus:ring-2 focus:ring-maasai-red transition-shadow" />
            </div>
          </div>
        )}
      </div>

      {/* Region */}
      <div>
        <button onClick={() => setRegionOpen((p) => !p)}
          className="flex items-center justify-between w-full mb-3 group">
          <span className={sectionLabel + ' mb-0'}>Region</span>
          {regionOpen
            ? <ChevronUp className="h-4 w-4 text-maasai-brown/40 group-hover:text-maasai-red transition-colors" />
            : <ChevronDown className="h-4 w-4 text-maasai-brown/40 group-hover:text-maasai-red transition-colors" />}
        </button>
        {regionOpen && (
          <div className="space-y-1">
            <button onClick={() => update('region', undefined)}
              className={cn(optionBase, !filters.region ? optionActive : optionIdle)}>
              All Regions
            </button>
            {KENYAN_REGIONS.map((region) => (
              <button key={region} onClick={() => update('region', region)}
                className={cn(optionBase, filters.region === region ? optionActive : optionIdle)}>
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
      {/* Desktop sidebar */}
      <div className={cn('hidden lg:block', className)}>
        <div className="sticky top-24 bg-white dark:bg-maasai-brown rounded-2xl border border-maasai-beige/40 dark:border-maasai-brown-light p-6 shadow-card">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2">
              <SlidersHorizontal className="h-4 w-4 text-maasai-red" />
              <h2 className="font-semibold text-maasai-black dark:text-white">Filters</h2>
            </div>
            {hasActiveFilters && (
              <span className="bg-maasai-red text-white text-[10px] rounded-full px-2 py-0.5 font-bold uppercase tracking-wide">
                Active
              </span>
            )}
          </div>
          <FilterContent />
        </div>
      </div>

      {/* Mobile trigger */}
      <div className="lg:hidden fixed bottom-5 left-5 z-30">
        <button onClick={() => setMobileOpen(true)}
          className="flex items-center gap-2 bg-maasai-black dark:bg-maasai-brown text-white px-4 py-2.5 rounded-full shadow-maasai font-semibold text-sm border border-maasai-red/30">
          <SlidersHorizontal className="h-4 w-4" />
          Filters
          {hasActiveFilters && (
            <span className="bg-maasai-red text-white text-[10px] rounded-full w-4 h-4 flex items-center justify-center font-bold">!</span>
          )}
        </button>
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setMobileOpen(false)} />
          <div className="relative ml-auto w-80 max-w-full bg-white dark:bg-maasai-brown h-full overflow-y-auto p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-7">
              <div className="flex items-center gap-2">
                <SlidersHorizontal className="h-4 w-4 text-maasai-red" />
                <h2 className="font-semibold text-maasai-black dark:text-white text-base">Filters</h2>
              </div>
              <button onClick={() => setMobileOpen(false)}
                className="p-1.5 rounded-lg hover:bg-maasai-beige/30 dark:hover:bg-maasai-brown-light transition-colors">
                <X className="h-5 w-5 text-maasai-brown dark:text-maasai-beige" />
              </button>
            </div>
            <FilterContent />
          </div>
        </div>
      )}
    </>
  );
}
