'use client'

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
            className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-colors duration-150 ${
              on
                ? 'bg-mytra-purple text-white border-mytra-purple'
                : 'bg-mytra-bg text-gray-400 border-mytra-border hover:text-white hover:border-mytra-purple/50'
            }`}
          >
            {o}
          </button>
        )
      })}
    </div>
  )
}
