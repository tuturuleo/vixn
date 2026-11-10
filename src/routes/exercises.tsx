import { useRef, useState } from 'react'
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
  loader: () => exercisesRepo.listAll(),
  component: ExercisesPage,
})

function ExercisesPage() {
  const allExercises = Route.useLoaderData()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState<Exercise | null>(null)
  const [showArchive, setShowArchive] = useState(false)
  const [restoringId, setRestoringId] = useState<string | null>(null)
  const restorePending = useRef(false)
  const [restoreError, setRestoreError] = useState<string | null>(null)
  const exercises = allExercises.filter((exercise) => exercise.archived === showArchive)

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

  const handleRestore = async (id: string) => {
    if (restorePending.current) return
    restorePending.current = true
    setRestoringId(id)
    setRestoreError(null)
    try {
      await exercisesRepo.restore(id)
      await router.invalidate()
    } catch {
      setRestoreError(id)
    } finally {
      restorePending.current = false
      setRestoringId(null)
    }
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

      <div role="group" aria-label="Список упражнений" className="mb-4 flex gap-2">
        <Button
          variant={showArchive ? 'outline' : 'secondary'}
          aria-pressed={!showArchive}
          onClick={() => setShowArchive(false)}
        >
          Активные
        </Button>
        <Button
          variant={showArchive ? 'secondary' : 'outline'}
          aria-pressed={showArchive}
          onClick={() => setShowArchive(true)}
        >
          Архив
        </Button>
      </div>

      {showArchive ? (
        exercises.length === 0 ? (
          <EmptyState
            icon={Activity}
            title="Архив пуст"
            description="Здесь появятся архивные упражнения"
          />
        ) : (
          <ul className="flex flex-col gap-2">
            {exercises.map((exercise) => (
              <li key={exercise.id} className="rounded-xl border border-border bg-card px-4 py-3">
                <div className="flex items-center gap-3">
                  <p className="min-w-0 flex-1 break-words font-medium">{exercise.name}</p>
                  <Button
                    variant="outline"
                    disabled={restoringId !== null}
                    onClick={() => handleRestore(exercise.id)}
                  >
                    {restoringId === exercise.id ? 'Восстановление…' : 'Восстановить'}
                  </Button>
                </div>
                {restoreError === exercise.id && (
                  <p role="alert" className="mt-2 text-sm text-destructive">
                    Не удалось восстановить упражнение. Нажмите «Восстановить», чтобы повторить.
                  </p>
                )}
              </li>
            ))}
          </ul>
        )
      ) : exercises.length === 0 ? (
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
