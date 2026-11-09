import { useEffect, useMemo, useState } from 'react'
import { createFileRoute, Link } from '@tanstack/react-router'
import { LineChart as LineChartIcon, ChevronDown, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from '@/components/ui/drawer'
import { ProgressChart } from '@/features/progress/ProgressChart'
import { sessionsRepo } from '@/db/repositories'
import {
  collectExerciseStats,
  buildSeries,
  type ExerciseStat,
} from '@/domain/progress'
import { totalSets } from '@/domain/session'
import { METRIC_META, type MetricType } from '@/domain/metrics'
import type { WorkoutSession } from '@/domain/schemas'
import { formatDateTime } from '@/lib/datetime'
import { setsWord } from '@/lib/plural'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/progress')({
  loader: async () => {
    const sessions = await sessionsRepo.listCompleted()
    return { sessions, stats: collectExerciseStats(sessions) }
  },
  component: ProgressPage,
})

type Tab = 'exercise' | 'history'

function ProgressPage() {
  const { sessions, stats } = Route.useLoaderData()
  const [tab, setTab] = useState<Tab>('exercise')

  return (
    <>
      <PageHeader title="Прогресс" subtitle="Динамика по упражнениям" />

      <div className="mb-4 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
        <SegBtn active={tab === 'exercise'} onClick={() => setTab('exercise')}>
          По упражнению
        </SegBtn>
        <SegBtn active={tab === 'history'} onClick={() => setTab('history')}>
          История
        </SegBtn>
      </div>

      {sessions.length === 0 ? (
        <EmptyState
          icon={LineChartIcon}
          title="Пока нет данных"
          description="Завершите тренировку, чтобы увидеть прогресс"
        />
      ) : tab === 'exercise' ? (
        <ExerciseTab sessions={sessions} stats={stats} />
      ) : (
        <HistoryTab sessions={sessions} />
      )}
    </>
  )
}

function SegBtn({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-md py-2 text-sm font-medium transition-colors',
        active
          ? 'bg-background text-foreground shadow-xs'
          : 'text-muted-foreground',
      )}
    >
      {children}
    </button>
  )
}

function ExerciseTab({
  sessions,
  stats,
}: {
  sessions: WorkoutSession[]
  stats: ExerciseStat[]
}) {
  const [exerciseId, setExerciseId] = useState(stats[0]?.id ?? '')
  const [pickerOpen, setPickerOpen] = useState(false)

  const stat = stats.find((s) => s.id === exerciseId) ?? stats[0]
  const [metric, setMetric] = useState<MetricType>(stat?.metrics[0] ?? 'weight')

  // Keep the selected metric valid when the exercise changes.
  useEffect(() => {
    if (stat && !stat.metrics.includes(metric)) setMetric(stat.metrics[0])
  }, [stat, metric])

  const points = useMemo(
    () => (stat ? buildSeries(sessions, stat.id, metric) : []),
    [sessions, stat, metric],
  )

  if (!stat) return null

  return (
    <div className="flex flex-col gap-4">
      <button
        onClick={() => setPickerOpen(true)}
        className="flex items-center justify-between rounded-xl border border-border bg-card px-4 py-3 text-left"
      >
        <span className="font-medium">{stat.name}</span>
        <ChevronDown className="size-5 text-muted-foreground" />
      </button>

      <div className="flex flex-wrap gap-2">
        {stat.metrics.map((m) => (
          <button
            key={m}
            onClick={() => setMetric(m)}
            className={cn(
              'rounded-full border px-3 py-1.5 text-sm font-medium transition-colors',
              m === metric
                ? 'border-primary bg-primary/10 text-foreground'
                : 'border-input text-muted-foreground',
            )}
          >
            {METRIC_META[m].label}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-card p-3 pr-4">
        <ProgressChart points={points} metric={metric} />
        {points.length < 2 && (
          <p className="px-1 pb-1 text-center text-xs text-muted-foreground">
            Нужно минимум 2 тренировки для линии тренда
          </p>
        )}
      </div>

      <Drawer open={pickerOpen} onOpenChange={setPickerOpen}>
        <DrawerContent className="max-h-[80dvh]">
          <DrawerHeader>
            <DrawerTitle>Упражнение</DrawerTitle>
          </DrawerHeader>
          <ul
            className="flex flex-col gap-1 overflow-y-auto px-3 pb-4"
            style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
          >
            {stats.map((s) => (
              <li key={s.id}>
                <button
                  onClick={() => {
                    setExerciseId(s.id)
                    setPickerOpen(false)
                  }}
                  className={cn(
                    'w-full rounded-lg px-3 py-3 text-left font-medium',
                    s.id === stat.id ? 'bg-primary/10 text-primary' : '',
                  )}
                >
                  {s.name}
                </button>
              </li>
            ))}
          </ul>
        </DrawerContent>
      </Drawer>
    </div>
  )
}

function HistoryTab({ sessions }: { sessions: WorkoutSession[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {sessions.map((session) => {
        const sets = totalSets(session)
        return (
          <li key={session.id}>
            <Link
              to="/workout/$sessionId"
              params={{ sessionId: session.id }}
              className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:scale-[0.99]"
            >
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{session.templateName}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {formatDateTime(session.finishedAt ?? session.startedAt)} ·{' '}
                  {session.entries.length} упр · {sets} {setsWord(sets)}
                </p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
            </Link>
          </li>
        )
      })}
    </ul>
  )
}
