import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import { formatDate } from '@/lib/datetime'
import { formatMetricValue, type MetricType } from '@/domain/metrics'
import type { ProgressPoint } from '@/domain/progress'

const BRAND = '#f97316'
const AXIS = 'rgba(255,255,255,0.45)'
const GRID = 'rgba(255,255,255,0.07)'

const axisDate = (ms: number) =>
  new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(ms)

function ChartTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean
  payload?: Array<{ payload: ProgressPoint }>
  metric: MetricType
}) {
  if (!active || !payload?.length) return null
  const point = payload[0].payload
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="text-muted-foreground">{formatDate(point.date)}</div>
      <div className="font-semibold tabular-nums">
        {formatMetricValue(metric, point.value)}
      </div>
    </div>
  )
}

export function ProgressChart({
  points,
  metric,
}: {
  points: ProgressPoint[]
  metric: MetricType
}) {
  return (
    <ResponsiveContainer width="100%" height={240}>
      <LineChart data={points} margin={{ top: 10, right: 10, left: -12, bottom: 0 }}>
        <CartesianGrid stroke={GRID} vertical={false} />
        <XAxis
          dataKey="date"
          type="number"
          scale="time"
          domain={['dataMin', 'dataMax']}
          tickFormatter={axisDate}
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
          minTickGap={28}
        />
        <YAxis
          tick={{ fontSize: 11, fill: AXIS }}
          axisLine={false}
          tickLine={false}
          width={40}
          allowDecimals={false}
        />
        <Tooltip
          content={<ChartTooltip metric={metric} />}
          cursor={{ stroke: GRID }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={BRAND}
          strokeWidth={2.5}
          dot={{ r: 3, fill: BRAND, strokeWidth: 0 }}
          activeDot={{ r: 5 }}
          isAnimationActive={false}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
