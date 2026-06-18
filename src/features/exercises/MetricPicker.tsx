import { Check } from 'lucide-react'
import { METRIC_TYPES, METRIC_META, type MetricType } from '@/domain/metrics'
import { cn } from '@/lib/utils'

export function MetricPicker({
  value,
  onChange,
}: {
  value: MetricType[]
  onChange: (next: MetricType[]) => void
}) {
  const toggle = (m: MetricType) =>
    onChange(value.includes(m) ? value.filter((x) => x !== m) : [...value, m])

  return (
    <div className="grid grid-cols-2 gap-2">
      {METRIC_TYPES.map((m) => {
        const active = value.includes(m)
        const meta = METRIC_META[m]
        return (
          <button
            key={m}
            type="button"
            onClick={() => toggle(m)}
            aria-pressed={active}
            className={cn(
              'flex items-center justify-between rounded-lg border px-3 py-3 text-left text-sm font-medium transition-colors',
              active
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-input text-muted-foreground',
            )}
          >
            <span>
              {meta.label}
              {meta.unit && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {meta.unit}
                </span>
              )}
            </span>
            <span
              className={cn(
                'flex size-5 items-center justify-center rounded-full border',
                active
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-input',
              )}
            >
              {active && <Check className="size-3.5" strokeWidth={3} />}
            </span>
          </button>
        )
      })}
    </div>
  )
}
