'use client'

import { ReactNode } from 'react'

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
    <div role="tablist" aria-label="Equipment information" className="flex w-full border-b border-mytra-border" onKeyDown={handleKeyDown}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab
        return (
          <button
            key={tab.id}
            role="tab"
            id={`tab-${tab.id}`}
            aria-selected={isActive}
            aria-controls={`tabpanel-${tab.id}`}
            tabIndex={isActive ? 0 : -1}
            onClick={() => onTabChange(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-2 sm:px-4 py-3 text-xs sm:text-sm font-medium
                        transition-colors duration-150 border-b-2
                        ${
                          isActive
                            ? 'border-mytra-purple text-white'
                            : 'border-transparent text-fg-4 hover:text-fg'
                        }`}
          >
            {tab.icon && <span className="w-4 h-4 hidden sm:block">{tab.icon}</span>}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
