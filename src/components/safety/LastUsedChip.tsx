'use client'

interface LastUsedChipProps {
  label: string
  value: string
  currentValue: string
  onApply: (value: string) => void
}

export default function LastUsedChip({ label, value, currentValue, onApply }: LastUsedChipProps) {
  if (!value || currentValue === value) return null
  return (
    <button
      type="button"
      onClick={() => onApply(value)}
      className="inline-flex items-center gap-1 text-xs px-2 py-1 rounded-full
                 bg-mytra-purple/10 border border-mytra-purple/20 text-mytra-purple
                 hover:bg-mytra-purple/20 transition-colors"
    >
      {label}: {value.length > 24 ? value.slice(0, 22) + '…' : value}
    </button>
  )
}
