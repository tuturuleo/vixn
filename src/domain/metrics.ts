/** The base metric types a single set can record. */
export const METRIC_TYPES = ['weight', 'reps', 'duration', 'distance'] as const
export type MetricType = (typeof METRIC_TYPES)[number]

export interface MetricMeta {
  type: MetricType
  label: string
  /** Short unit label shown next to the value; empty for unitless reps. */
  unit: string
  /** Sensible stepper increment on the input. */
  step: number
  /** Allowed decimal places when storing/formatting. */
  precision: number
}

export const METRIC_META: Record<MetricType, MetricMeta> = {
  weight: { type: 'weight', label: 'Вес', unit: 'кг', step: 2.5, precision: 1 },
  reps: { type: 'reps', label: 'Повторы', unit: '', step: 1, precision: 0 },
  duration: { type: 'duration', label: 'Время', unit: 'сек', step: 5, precision: 0 },
  distance: { type: 'distance', label: 'Дистанция', unit: 'м', step: 10, precision: 0 },
}

export function formatMetricValue(type: MetricType, value: number): string {
  const { unit, precision } = METRIC_META[type]
  const num = precision === 0 ? Math.round(value) : Number(value.toFixed(precision))
  return unit ? `${num} ${unit}` : `${num}`
}
