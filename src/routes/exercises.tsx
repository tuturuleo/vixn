import { useState } from 'react'
import { createFileRoute, useRouter } from '@tanstack/react-router'
import { Plus, Activity, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ExerciseFormSheet } from '@/features/exercises/ExerciseFormSheet'
import { exercisesRepo, type ExerciseInput } from '@/db/repositories'
import { METRIC_META } from '@/domain/metrics'
import type { Exercise } from '@/domain/schemas'

export const Route = createFileRoute('/exercises')({
  loader: () => exercisesRepo.list(),
  component: ExercisesPage,
})

function ExercisesPage() {
  const exercises = Route.useLoaderData()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)

  const openCreate = () => {
    setEditing(null)
    setOpen(true)
  }
  const openEdit = (exercise: Exercise) => {
    setEditing(exercise)
    setOpen(true)
  }

  const handleSubmit = async (input: ExerciseInput) => {
    if (editing) await exercisesRepo.update(editing.id, input)
    else await exercisesRepo.create(input)
    await router.invalidate()
  }

  const handleArchive = async (id: string) => {
    await exercisesRepo.archive(id)
    await router.invalidate()
  }

  return (
    <>
      <PageHeader
        title="Упражнения"
        subtitle="Справочник"
        action={
          <Button size="icon" onClick={openCreate} aria-label="Добавить">
            <Plus className="size-5" />
          </Button>
        }
      />

      {exercises.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="Пока нет упражнений"
          description="Добавьте упражнения, чтобы собирать из них тренировки"
          action={
            <Button onClick={openCreate}>
              <Plus className="size-4" />
              Добавить упражнение
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <button
                onClick={() => openEdit(exercise)}
                className="flex w-full items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left active:scale-[0.99]"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium">{exercise.name}</p>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {exercise.metrics.map((m) => (
                      <Badge key={m} variant="muted">
                        {METRIC_META[m].label}
                      </Badge>
                    ))}
                  </div>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
              </button>
            </li>
          ))}
        </ul>
      )}

      <ExerciseFormSheet
        open={open}
        onOpenChange={setOpen}
        exercise={editing}
        onSubmit={handleSubmit}
        onArchive={handleArchive}
      />
    </>
  )
}
