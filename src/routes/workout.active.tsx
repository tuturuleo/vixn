import { useEffect, useRef } from 'react'
import { createFileRoute, useNavigate, useRouter } from '@tanstack/react-router'
import { X, ArrowLeft, ArrowRight, Check, Dumbbell, Trash2 } from 'lucide-react'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import { NumberField } from '@/features/workout/NumberField'
import { useActiveWorkout } from '@/stores/activeWorkout'
import { flatSteps, stepIndex } from '@/domain/session'
import { formatSetLine } from '@/domain/metrics'
import { setsWord } from '@/lib/plural'

export const Route = createFileRoute('/workout/active')({
  component: ActiveWorkoutPage,
})

function ActiveWorkoutPage() {
  const navigate = useNavigate()
  const router = useRouter()
  const session = useActiveWorkout((s) => s.session)
  const hydrated = useActiveWorkout((s) => s.hydrated)
  const loadActive = useActiveWorkout((s) => s.loadActive)
  const setMetric = useActiveWorkout((s) => s.setMetric)
  const next = useActiveWorkout((s) => s.next)
  const prev = useActiveWorkout((s) => s.prev)
  const complete = useActiveWorkout((s) => s.complete)
  const discard = useActiveWorkout((s) => s.discard)
  // Terminal actions navigate after invalidation; do not race them with the
  // no-session redirect while they are finishing.
  const exitingRef = useRef(false)

  useEffect(() => {
    if (!hydrated) void loadActive()
  }, [hydrated, loadActive])

  // After hydration, bounce out if there is nothing to record.
  useEffect(() => {
    if (hydrated && !session && !exitingRef.current) {
      navigate({ to: '/workout/start' })
    }
  }, [hydrated, session, navigate])

  if (!session) return null

  const steps = flatSteps(session)
  if (steps.length === 0) {
    const handleDiscard = async () => {
      exitingRef.current = true
      await discard()
      await router.invalidate()
      navigate({ to: '/' })
    }
    return (
      <EmptyState
        icon={Dumbbell}
        title="В тренировке нет упражнений"
        action={
          <Button variant="outline" onClick={handleDiscard}>
            Отменить тренировку
          </Button>
        }
      />
    )
  }

  const idx = stepIndex(session, session.cursor)
  const { entryIndex, setIndex } = session.cursor
  const entry = session.entries[entryIndex]
  const set = entry.sets[setIndex]
  const isFirst = idx <= 0
  const isLast = idx === steps.length - 1
  const prevSet = setIndex > 0 ? entry.sets[setIndex - 1] : null

  const handleNext = async () => {
    if (!isLast) return next()
    exitingRef.current = true
    try {
      const done = await complete()
      if (done) {
        await router.invalidate()
        await navigate({ to: '/workout/$sessionId', params: { sessionId: done.id } })
      }
    } finally {
      exitingRef.current = false
    }
  }

  const handleDiscard = async () => {
    if (!window.confirm('Отменить тренировку? Записанные подходы будут удалены.')) {
      return
    }
    exitingRef.current = true
    await discard()
    await router.invalidate()
    navigate({ to: '/' })
  }

  return (
    <div className="flex min-h-[80dvh] flex-col">
      <header className="mb-4 flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => navigate({ to: '/' })}
          aria-label="Выйти"
        >
          <X className="size-5" />
        </Button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{session.templateName}</p>
        </div>
        <span className="text-sm tabular-nums text-muted-foreground">
          {idx + 1}/{steps.length}
        </span>
        <Button
          variant="ghost"
          size="icon"
          onClick={handleDiscard}
          aria-label="Отменить"
          title="Отменить"
        >
          <Trash2 className="size-5" />
        </Button>
      </header>

      <div className="mb-6 h-1.5 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-[width]"
          style={{ width: `${((idx + 1) / steps.length) * 100}%` }}
        />
      </div>

      <div className="flex-1">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Упражнение {entryIndex + 1} из {session.entries.length}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {entry.exerciseName}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Подход {setIndex + 1} из {entry.sets.length} ·{' '}
          {entry.sets.length} {setsWord(entry.sets.length)}
        </p>

        {prevSet && Object.keys(prevSet.values).length > 0 && (
          <p className="mt-3 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
            Прошлый подход: {formatSetLine(entry.metrics, prevSet.values)}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-5">
          {entry.metrics.map((metric) => (
            <NumberField
              key={`${session.id}:${entryIndex}:${setIndex}:${metric}`}
              metric={metric}
              value={set.values[metric] ?? null}
              onChange={(value) =>
                setMetric({ entryIndex, setIndex }, metric, value)
              }
            />
          ))}
        </div>
      </div>

      <div className="sticky bottom-0 mt-6 flex gap-3 bg-background pt-2 pb-2">
        <Button
          variant="outline"
          size="lg"
          className="flex-1"
          onClick={prev}
          disabled={isFirst}
        >
          <ArrowLeft className="size-5" />
          Назад
        </Button>
        <Button size="lg" className="flex-1" onClick={handleNext}>
          {isLast ? (
            <>
              <Check className="size-5" />
              Завершить
            </>
          ) : (
            <>
              Далее
              <ArrowRight className="size-5" />
            </>
          )}
        </Button>
      </div>
    </div>
  )
}
