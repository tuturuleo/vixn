import { createFileRoute, useNavigate, Link } from '@tanstack/react-router'
import { Play, ListChecks, History } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import {
  templatesRepo,
  exercisesRepo,
  sessionsRepo,
} from '@/db/repositories'
import { buildSessionFromTemplate, templateSetCount } from '@/domain/session'
import { setsWord } from '@/lib/plural'
import { useActiveWorkout } from '@/stores/activeWorkout'
import type { WorkoutTemplate } from '@/domain/schemas'

export const Route = createFileRoute('/workout/start')({
  loader: async () => {
    const [templates, exercises, active] = await Promise.all([
      templatesRepo.list(),
      exercisesRepo.listAll(),
      sessionsRepo.getActive(),
    ])
    const exercisesById = Object.fromEntries(exercises.map((e) => [e.id, e]))
    return { templates, exercisesById, active }
  },
  component: WorkoutStartPage,
})

function WorkoutStartPage() {
  const { templates, exercisesById, active } = Route.useLoaderData()
  const navigate = useNavigate()
  const start = useActiveWorkout((s) => s.start)

  const handlePick = async (template: WorkoutTemplate) => {
    const session = buildSessionFromTemplate(template, exercisesById)
    await start(session)
    navigate({ to: '/workout/active' })
  }

  return (
    <>
      <PageHeader title="Начать тренировку" subtitle="Выберите тренировку" />

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
                  onClick={() => handlePick(template)}
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
