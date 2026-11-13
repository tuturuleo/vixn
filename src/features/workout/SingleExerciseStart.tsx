import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { Dumbbell, Minus, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ExercisePickerSheet } from '@/features/templates/ExercisePickerSheet'
import type { Exercise } from '@/domain/schemas'
import { setsWord } from '@/lib/plural'

export function SingleExerciseStart({ exercises, saving, onStart }: {
  exercises: Exercise[]
  saving: boolean
  onStart: (exercise: Exercise, sets: number) => Promise<void>
}) {
  const [pickerOpen, setPickerOpen] = useState(false)
  const [exercise, setExercise] = useState<Exercise | null>(null)
  const [sets, setSets] = useState(3)

  return (
    <section className="mb-4 flex flex-col gap-3 rounded-xl border border-border bg-card p-4">
      <Button variant="outline" disabled={saving} onClick={() => setPickerOpen(true)}>
        <Dumbbell className="size-4" />
        Выполнить упражнение
      </Button>
      {exercises.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Нет активных упражнений. <Link to="/exercises" className="text-primary underline">Добавьте упражнение в справочник</Link>.
        </p>
      ) : exercise && (
        <>
          <p className="break-words font-medium">{exercise.name}</p>
          <div className="flex items-center justify-between gap-2" role="group" aria-label="Количество подходов">
            <span className="text-sm">{sets} {setsWord(sets)}</span>
            <div className="flex gap-2">
              <Button variant="outline" size="icon" aria-label="Меньше подходов" disabled={saving || sets <= 1} onClick={() => setSets(sets - 1)}>
                <Minus className="size-4" />
              </Button>
              <Button variant="outline" size="icon" aria-label="Больше подходов" disabled={saving || sets >= 20} onClick={() => setSets(sets + 1)}>
                <Plus className="size-4" />
              </Button>
            </div>
          </div>
          <Button disabled={saving} onClick={() => onStart(exercise, sets)}>
            {saving ? 'Запуск…' : 'Начать упражнение'}
          </Button>
          <Button variant="ghost" disabled={saving} onClick={() => setExercise(null)}>Отмена</Button>
        </>
      )}
      <ExercisePickerSheet
        title="Выполнить упражнение"
        open={pickerOpen && exercises.length > 0}
        onOpenChange={setPickerOpen}
        exercises={exercises}
        onPick={(selected) => { setExercise(selected); setSets(3) }}
      />
    </section>
  )
}
