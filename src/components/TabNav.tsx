'use client'

import { ReactNode, useRef, useEffect, useState } from 'react'

interface Tab {
  id: string
  label: string
  icon?: ReactNode
}

interface TabNavProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (id: string) => void
}

export default function TabNav({ tabs, activeTab, onTabChange }: TabNavProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [indicator, setIndicator] = useState({ left: 0, width: 0 })

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    const activeEl = container.querySelector<HTMLElement>(`[data-tab-id="${activeTab}"]`)
    if (activeEl) {
      setIndicator({
        left: activeEl.offsetLeft,
        width: activeEl.offsetWidth,
      })
    }
  }, [activeTab, tabs])

  function handleKeyDown(e: React.KeyboardEvent) {
    const tabIds = tabs.map((t) => t.id)
    const currentIndex = tabIds.indexOf(activeTab)
    let nextIndex: number | null = null
    if (e.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabIds.length
    if (e.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabIds.length) % tabIds.length
    if (nextIndex !== null) {
      e.preventDefault()
      onTabChange(tabIds[nextIndex])
      document.getElementById(`tab-${tabIds[nextIndex]}`)?.focus()
    }
  }

  return (
    <div
      ref={containerRef}
      role="tablist"
      aria-label="Equipment information"
      className="no-print relative flex w-full border-b border-mytra-border"
      onKeyDown={handleKeyDown}
    >
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            data-tab-id={tab.id}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium min-h-[44px]
                        transition-colors duration-200
                        ${isActive ? 'text-fg' : 'text-fg-4 hover:text-fg'}`}
          >
            {tab.icon && <span className="w-4 h-4 hidden sm:block">{tab.icon}</span>}
            {tab.label}
          </button>
        )
      })}
      {/* Sliding active indicator */}
      <div
        className="absolute bottom-0 h-0.5 bg-mytra-purple rounded-full transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)]"
        style={{ left: indicator.left, width: indicator.width }}
      />
    </div>
  )
}
