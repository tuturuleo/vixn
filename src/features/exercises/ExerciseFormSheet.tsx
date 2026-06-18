import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from '@/components/ui/drawer'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { MetricPicker } from './MetricPicker'
import type { MetricType } from '@/domain/metrics'
import type { Exercise } from '@/domain/schemas'
import type { ExerciseInput } from '@/db/repositories'

export function ExerciseFormSheet({
  open,
  onOpenChange,
  exercise,
  onSubmit,
  onArchive,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercise: Exercise | null
  onSubmit: (input: ExerciseInput) => Promise<void> | void
  onArchive: (id: string) => Promise<void> | void
}) {
  const [name, setName] = useState('')
  const [metrics, setMetrics] = useState<MetricType[]>(['weight', 'reps'])
  const [saving, setSaving] = useState(false)

  // Sync local form state each time the sheet opens.
  useEffect(() => {
    if (open) {
      setName(exercise?.name ?? '')
      setMetrics(exercise?.metrics ?? ['weight', 'reps'])
      setSaving(false)
    }
  }, [open, exercise])

  const valid = name.trim().length > 0 && metrics.length > 0

  const handleSave = async () => {
    if (!valid || saving) return
    setSaving(true)
    await onSubmit({ name: name.trim(), metrics })
    onOpenChange(false)
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent>
        <DrawerHeader>
          <DrawerTitle>
            {exercise ? 'Упражнение' : 'Новое упражнение'}
          </DrawerTitle>
          <DrawerDescription>
            Название и какие показатели фиксируем в подходе
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex flex-col gap-4 px-4 py-2">
          <div className="grid gap-2">
            <Label htmlFor="exercise-name">Название</Label>
            <Input
              id="exercise-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Напр. Жим лёжа"
              autoComplete="off"
            />
          </div>

          <div className="grid gap-2">
            <Label>Показатели подхода</Label>
            <MetricPicker value={metrics} onChange={setMetrics} />
          </div>
        </div>

        <DrawerFooter>
          <Button size="lg" onClick={handleSave} disabled={!valid || saving}>
            {exercise ? 'Сохранить' : 'Добавить'}
          </Button>
          {exercise && (
            <Button
              variant="ghost"
              className="text-destructive hover:text-destructive"
              onClick={async () => {
                await onArchive(exercise.id)
                onOpenChange(false)
              }}
            >
              <Trash2 className="size-4" />
              Архивировать
            </Button>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  )
}
