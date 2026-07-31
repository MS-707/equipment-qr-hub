'use client'
import { btnSelectedCls } from '@/lib/form-styles'
import { useLocale } from '@/lib/i18n'
import { optionLabel } from '@/lib/i18n-data'

interface ChipMultiSelectProps {
  options: string[]
  selected: string[]
  onChange: (value: string[]) => void
}

/**
 * Values stay the canonical English source strings (records translate at
 * insertion time via mapEs); only the chip LABEL renders in the viewer's
 * locale (ES-6).
 */
export default function ChipMultiSelect({ options, selected, onChange }: ChipMultiSelectProps) {
  const { locale } = useLocale()
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
            {optionLabel(locale, o)}
          </button>
        )
      })}
    </div>
  )
}
