'use client'
import { btnSelectedCls } from '@/lib/form-styles'

interface ChipMultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}

export default function ChipMultiSelect({ options, selected, onChange }: ChipMultiSelectProps) {
  function toggle(o: string) {
    onChange(selected.includes(o) ? selected.filter((x) => x !== o) : [...selected, o])
  }
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o)
        return (
          <button
            key={o}
            type="button"
            onClick={() => toggle(o)}
            aria-pressed={on}
            className={`text-xs font-medium px-3 py-2.5 rounded-full border transition-colors duration-150 min-h-[44px] ${
              on
                ? `${btnSelectedCls} border-mytra-purple`
                : 'bg-mytra-bg text-fg-2 border-mytra-border hover:text-fg hover:border-mytra-purple/50'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
