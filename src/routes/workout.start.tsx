import { useRef, useState } from 'react'
import { createFileRoute, useNavigate, Link, useRouter } from '@tanstack/react-router'
import { Play, ListChecks, History } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import {
  templatesRepo,
  exercisesRepo,
  sessionsRepo,
} from '@/db/repositories'
import { buildSessionFromExercise, buildSessionFromTemplate, templateSetCount } from '@/domain/session'
import { SingleExerciseStart } from '@/features/workout/SingleExerciseStart'
import { setsWord } from '@/lib/plural'
import { useActiveWorkout } from '@/stores/activeWorkout'
import type { WorkoutSession } from '@/domain/schemas'

export const Route = createFileRoute('/workout/start')({
  loader: async () => {
    const [templates, exercises, active] = await Promise.all([
      templatesRepo.list(),
      exercisesRepo.listAll(),
      sessionsRepo.getActive(),
    ])
    const exercisesById = Object.fromEntries(exercises.map((e) => [e.id, e]))
    return { templates, exercisesById, exercises: exercises.filter((e) => !e.archived), active }
  },
  component: WorkoutStartPage,
})

function WorkoutStartPage() {
  const { templates, exercisesById, exercises, active } = Route.useLoaderData()
  const navigate = useNavigate()
  const router = useRouter()
  const start = useActiveWorkout((s) => s.start)

  const pending = useRef(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleStart = async (session: WorkoutSession) => {
    if (pending.current) return
    pending.current = true
    setSaving(true)
    setError(null)
    try {
      await start(session)
      await router.invalidate()
      await navigate({ to: '/workout/active' })
    } catch {
      setError('Не удалось начать выполнение. Попробуйте ещё раз.')
    } finally {
      pending.current = false
      setSaving(false)
    }
  }

  return (
    <>
      <PageHeader title="Начать тренировку" subtitle="Выберите тренировку или одно упражнение" />

      {active && (
        <Link
          to="/workout/active"
          className="mb-4 flex items-center gap-3 rounded-xl border border-primary/40 bg-primary/10 px-4 py-3 active:scale-[0.99]"
        >
          <History className="size-5 text-primary" />
          <div className="min-w-0 flex-1">
            <p className="truncate font-medium">Продолжить тренировку</p>
            <p className="truncate text-xs text-muted-foreground">
              {active.templateName}
            </p>
          </div>
          <Play className="size-5 text-primary" />
        </Link>
      )}

      <SingleExerciseStart
        exercises={exercises}
        saving={saving}
        onStart={(exercise, sets) => handleStart(buildSessionFromExercise(exercise, sets))}
      />
      {error && <p role="alert" className="mb-4 text-sm text-destructive">{error}</p>}

      {templates.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Нет тренировок"
          description="Сначала создайте вид тренировки"
          action={
            <Button asChild>
              <Link to="/templates/new">Создать тренировку</Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((template) => {
            const sets = templateSetCount(template)
            return (
              <li key={template.id}>
                <button
                  onClick={() => handleStart(buildSessionFromTemplate(template, exercisesById))}
                  disabled={saving}
                  className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-4 text-left active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{template.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {template.items.length} упр · {sets} {setsWord(sets)}
                    </p>
                  </div>
                  <span className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Play className="size-5" />
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
