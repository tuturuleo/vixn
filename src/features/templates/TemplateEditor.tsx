import { useState } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Plus, Minus, X, Trash2, Dumbbell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { EmptyState } from '@/components/layout/EmptyState'
import { setsWord } from '@/lib/plural'
import { ExercisePickerSheet } from './ExercisePickerSheet'
import type { Exercise } from '@/domain/schemas'
import type { TemplateInput, TemplateItemInput } from '@/db/repositories'

interface DraftItem extends TemplateItemInput {
  name: string
}

const MAX_SETS = 20

export function TemplateEditor({
  title,
  exercises,
  initialName = '',
  initialItems = [],
  onSave,
  onDelete,
}: {
  title: string
  exercises: Exercise[]
  initialName?: string
  initialItems?: DraftItem[]
  onSave: (input: TemplateInput) => Promise<void>
  onDelete?: () => Promise<void>
}) {
  const navigate = useNavigate()
  const [name, setName] = useState(initialName)
  const [items, setItems] = useState<DraftItem[]>(initialItems)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  const valid = name.trim().length > 0 && items.length > 0

  const addExercise = (exercise: Exercise) =>
    setItems((prev) => [
      ...prev,
      { exerciseId: exercise.id, name: exercise.name, sets: 3 },
    ])

  const setSets = (index: number, delta: number) =>
    setItems((prev) =>
      prev.map((item, i) =>
        i === index
          ? { ...item, sets: Math.min(MAX_SETS, Math.max(1, item.sets + delta)) }
          : item,
      ),
    )

  const removeItem = (index: number) =>
    setItems((prev) => prev.filter((_, i) => i !== index))

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    await onSave({
      name: name.trim(),
      items: items.map(({ exerciseId, sets }) => ({ exerciseId, sets })),
    })
    navigate({ to: '/templates' })
  }

  const back = () => navigate({ to: '/templates' })

  return (
    <>
      <header className="mb-4 flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={back} aria-label="Назад">
          <ArrowLeft className="size-5" />
        </Button>
        <h1 className="text-xl font-bold tracking-tight">{title}</h1>
      </header>

      <div className="flex flex-col gap-5">
        <div className="grid gap-2">
          <Label htmlFor="template-name">Название</Label>
          <Input
            id="template-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Напр. Грудь и трицепс"
            autoComplete="off"
          />
        </div>

        <div className="grid gap-2">
          <div className="flex items-center justify-between">
            <Label>Упражнения</Label>
            <span className="text-xs text-muted-foreground">
              {items.length > 0 && `${items.length}`}
            </span>
          </div>

          {items.length === 0 ? (
            <EmptyState
              icon={Dumbbell}
              title="Добавьте упражнения"
              description="Выберите упражнения и задайте число подходов"
            />
          ) : (
            <ul className="flex flex-col gap-2">
              {items.map((item, index) => (
                <li
                  key={`${item.exerciseId}-${index}`}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-3 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.sets} {setsWord(item.sets)}
                    </p>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      onClick={() => setSets(index, -1)}
                      disabled={item.sets <= 1}
                      aria-label="Меньше подходов"
                    >
                      <Minus className="size-4" />
                    </Button>
                    <span className="w-6 text-center font-semibold tabular-nums">
                      {item.sets}
                    </span>
                    <Button
                      variant="outline"
                      size="icon"
                      className="size-9"
                      onClick={() => setSets(index, 1)}
                      disabled={item.sets >= MAX_SETS}
                      aria-label="Больше подходов"
                    >
                      <Plus className="size-4" />
                    </Button>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="size-9 text-muted-foreground"
                    onClick={() => removeItem(index)}
                    aria-label="Убрать"
                  >
                    <X className="size-4" />
                  </Button>
                </li>
              ))}
            </ul>
          )}

          <Button
            variant="outline"
            onClick={() => setPickerOpen(true)}
            disabled={exercises.length === 0}
          >
            <Plus className="size-4" />
            Добавить упражнение
          </Button>
          {exercises.length === 0 && (
            <p className="text-xs text-muted-foreground">
              Сначала добавьте упражнения в справочнике.
            </p>
          )}
        </div>

        <Button size="lg" onClick={handleSave} disabled={!valid || saving}>
          Сохранить тренировку
        </Button>

        {onDelete && (
          <Button
            variant="ghost"
            className="text-destructive hover:text-destructive"
            onClick={async () => {
              await onDelete()
              navigate({ to: '/templates' })
            }}
          >
            <Trash2 className="size-4" />
            Удалить тренировку
          </Button>
        )}
      </div>

      <ExercisePickerSheet
        open={pickerOpen}
        onOpenChange={setPickerOpen}
        exercises={exercises}
        onPick={addExercise}
      />
    </>
  )
}
