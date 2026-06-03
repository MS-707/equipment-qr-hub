'use client'

import { PPE_OPTIONS } from '@/data/safety-checklists'

interface PPESelectorProps {
  selected: string[]
  onChange: (ids: string[]) => void
}

export default function PPESelector({ selected, onChange }: PPESelectorProps) {
  function toggle(id: string) {
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id])
  }

  return (
    <div className="flex flex-wrap gap-2">
      {PPE_OPTIONS.map((p) => {
        const on = selected.includes(p.id)
        return (
          <button
            key={p.id}
            type="button"
            onClick={() => toggle(p.id)}
            aria-pressed={on}
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
              on
                ? 'bg-mytra-purple text-white border-mytra-purple'
                : 'bg-mytra-bg text-gray-400 border-mytra-border hover:text-white hover:border-mytra-purple/50'
            }`}
          >
            {p.label}
          </button>
        )
      })}
    </div>
  )
}
