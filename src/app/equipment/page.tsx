'use client'

import { useState, useEffect, useMemo, useCallback } from 'react'
import { Search, X, ChevronDown, ChevronRight } from 'lucide-react'
import {
  getAllEquipment,
  getCategories,
  searchEquipment,
} from '@/lib/equipment'
import { EquipmentCategory, CATEGORY_COLORS } from '@/lib/types'
import EquipmentCard from '@/components/EquipmentCard'
import { EquipmentCardSkeleton } from '@/components/Skeleton'
import ModuleTourButton from '@/components/onboarding/ModuleTourButton'

type FilterCategory = EquipmentCategory | 'all'

export default function EquipmentDirectory() {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<FilterCategory>('all')
  const [collapsedCategories, setCollapsedCategories] = useState<Set<string>>(new Set())
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    setLoaded(true)
  }, [])

  const toggleCategory = useCallback((category: string) => {
    setCollapsedCategories((prev) => {
      const next = new Set(prev)
      if (next.has(category)) {
        next.delete(category)
      } else {
        next.add(category)
      }
      return next
    })
  }, [])

  const allEquipment = useMemo(() => getAllEquipment(), [])
  const categories = useMemo(() => getCategories(), [])

  const filteredEquipment = useMemo(() => {
    let items = searchQuery.trim()
      ? searchEquipment(searchQuery)
      : allEquipment

    if (selectedCategory !== 'all') {
      items = items.filter((e) => e.category === selectedCategory)
    }

    return items
  }, [searchQuery, selectedCategory, allEquipment])

  // Group items by category for the "All" view
  const groupedEquipment = useMemo(() => {
    if (selectedCategory !== 'all') return null

    const groups: Partial<Record<EquipmentCategory, typeof filteredEquipment>> = {}
    for (const item of filteredEquipment) {
      if (!groups[item.category]) {
        groups[item.category] = []
      }
      groups[item.category]!.push(item)
    }
    return groups
  }, [filteredEquipment, selectedCategory])

  return (
    <main className="min-h-screen px-4 py-6 sm:px-6 lg:px-8 max-w-6xl mx-auto">
      {/* ── Header ──────────────────────────────────── */}
      <header className="mb-6">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="text-2xl sm:text-3xl font-bold text-fg">
            Equipment
          </h1>
          <span className="inline-flex items-center text-xs font-medium px-2.5 py-0.5 rounded-full bg-mytra-purple/20 text-mytra-purple">
            {allEquipment.length} items
          </span>
          <ModuleTourButton tourId="equipment-dir" />
        </div>
      </header>

      {/* ── Search ──────────────────────────────────── */}
      <div data-tour-module="equip-search" className="relative mb-4">
        <Search
          className="absolute left-3 top-1/2 -translate-y-1/2 text-fg-4 pointer-events-none"
          size={18}
        />
        <input
          type="text"
          inputMode="search"
          enterKeyHint="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search equipment..."
          aria-label="Search equipment"
          className="w-full bg-mytra-input border border-mytra-border rounded-lg py-2.5 pl-10 pr-10
                     text-sm text-fg placeholder:text-fg-4
                     focus:outline-none focus:ring-2 focus:ring-mytra-purple focus:border-transparent
                     transition-colors"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-fg-4 hover:text-fg
                       transition-colors p-0.5"
          >
            <X size={16} />
          </button>
        )}
      </div>

      {/* ── Category Filter Pills ───────────────────── */}
      <div data-tour-module="category-pills" className="flex flex-wrap gap-2 pb-4 mb-6">
        {/* "All" pill */}
        <button
          onClick={() => setSelectedCategory('all')}
          aria-pressed={selectedCategory === 'all'}
          className={`text-sm font-medium px-4 py-1.5 rounded-full transition-colors
            ${
              selectedCategory === 'all'
                ? 'bg-mytra-purple text-white'
                : 'bg-mytra-card border border-mytra-border text-fg-3 hover:bg-mytra-card-hover'
            }`}
        >
          All
          <span className="ml-1.5 text-xs opacity-60">{allEquipment.length}</span>
        </button>

        {categories.map((cat) => {
          const color = CATEGORY_COLORS[cat]
          const isSelected = selectedCategory === cat
          const count = allEquipment.filter((e) => e.category === cat).length

          return (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              aria-pressed={isSelected}
              className="text-sm font-medium px-3 py-1.5 rounded-full transition-colors border"
              style={
                isSelected
                  ? {
                      backgroundColor: `${color}30`,
                      borderColor: color,
                      color: color,
                    }
                  : {
                      backgroundColor: 'var(--surface)',
                      borderColor: 'var(--border)',
                      color: 'var(--fg-3)',
                    }
              }
            >
              {cat}
              <span className="ml-1.5 text-xs opacity-50">{count}</span>
            </button>
          )
        })}
      </div>

      {/* ── Equipment Grid ──────────────────────────── */}
      {!loaded ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          <EquipmentCardSkeleton />
          <EquipmentCardSkeleton />
          <EquipmentCardSkeleton />
          <EquipmentCardSkeleton />
          <EquipmentCardSkeleton />
          <EquipmentCardSkeleton />
        </div>
      ) : filteredEquipment.length === 0 ? (
        /* Empty state */
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <Search className="text-fg-4 mb-3" size={40} />
          <p className="text-fg-3 text-sm font-medium">No equipment found</p>
          <p className="text-fg-4 text-xs mt-1">
            Try adjusting your search or filter.
          </p>
        </div>
      ) : selectedCategory !== 'all' || !groupedEquipment ? (
        /* Flat grid — specific category selected */
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filteredEquipment.map((item, i) => (
            <div
              key={item.itemNumber}
              className="animate-fadeInUp"
              style={i < 12 ? { animationDelay: `${i * 30}ms` } : undefined}
              {...(i === 0 ? { 'data-tour-module': 'equip-card' } : {})}
            >
              <EquipmentCard equipment={item} />
            </div>
          ))}
        </div>
      ) : (
        /* Grouped by category — "All" selected */
        <div className="space-y-6">
          {Object.entries(groupedEquipment)
            .sort((a, b) => b[1]!.length - a[1]!.length)
            .map(([category, items], groupIndex) => {
            const color = CATEGORY_COLORS[category as EquipmentCategory]
            const isCollapsed = collapsedCategories.has(category)
            return (
              <section key={category}>
                <button
                  onClick={() => toggleCategory(category)}
                  aria-expanded={!isCollapsed}
                  className="flex items-center gap-2.5 mb-3 pl-3 border-l-[3px] w-full text-left
                             group cursor-pointer"
                  style={{ borderColor: color }}
                >
                  {isCollapsed ? (
                    <ChevronRight className="w-4 h-4 text-fg-4 group-hover:text-fg transition-colors" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-fg-4 group-hover:text-fg transition-colors" />
                  )}
                  <h2 className="text-sm font-semibold text-fg">
                    {category}
                  </h2>
                  <span
                    className="text-xs font-medium px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor: `${color}15`,
                      color: color,
                    }}
                  >
                    {items!.length}
                  </span>
                </button>

                {!isCollapsed && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                    {items!.map((item, i) => (
                      <div
                        key={item.itemNumber}
                        className="animate-fadeInUp"
                        style={i < 12 ? { animationDelay: `${i * 30}ms` } : undefined}
                        {...(groupIndex === 0 && i === 0 ? { 'data-tour-module': 'equip-card' } : {})}
                      >
                        <EquipmentCard equipment={item} showCategory={false} />
                      </div>
                    ))}
                  </div>
                )}
              </section>
            )
          })}
        </div>
      )}
    </main>
  )
}
