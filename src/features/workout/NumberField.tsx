import { Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { METRIC_META, type MetricType } from '@/domain/metrics'

export function NumberField({
  metric,
  value,
  onChange,
}: {
  metric: MetricType
  value: number | null
  onChange: (value: number | null) => void
}) {
  const meta = METRIC_META[metric]

  const clamp = (n: number) => Math.max(0, Number(n.toFixed(meta.precision)))
  const step = (delta: number) => onChange(clamp((value ?? 0) + delta))

  const handleInput = (raw: string) => {
    const normalized = raw.replace(',', '.').trim()
    if (normalized === '') return onChange(null)
    const n = Number(normalized)
    if (Number.isFinite(n)) onChange(clamp(n))
  }

  return (
    <div className="grid gap-1.5">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{meta.label}</span>
        {meta.unit && (
          <span className="text-xs text-muted-foreground">{meta.unit}</span>
        )}
      </div>
      <div className="flex items-stretch gap-2">
        <Button
          variant="outline"
          size="icon"
          className="size-12 shrink-0"
          onClick={() => step(-meta.step)}
          disabled={(value ?? 0) <= 0}
          aria-label={`${meta.label}: меньше`}
        >
          <Minus className="size-5" />
        </Button>
        <input
          inputMode="decimal"
          value={value ?? ''}
          onChange={(e) => handleInput(e.target.value)}
          placeholder="—"
          className="h-12 min-w-0 flex-1 rounded-md border border-input bg-transparent text-center text-2xl font-semibold tabular-nums outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
        />
        <Button
          variant="outline"
          size="icon"
          className="size-12 shrink-0"
          onClick={() => step(meta.step)}
          aria-label={`${meta.label}: больше`}
        >
          <Plus className="size-5" />
        </Button>
      </div>
    </div>
  )
}
