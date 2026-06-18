import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
} from '@/components/ui/drawer'
import { Badge } from '@/components/ui/badge'
import { METRIC_META } from '@/domain/metrics'
import type { Exercise } from '@/domain/schemas'

export function ExercisePickerSheet({
  open,
  onOpenChange,
  exercises,
  onPick,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  exercises: Exercise[]
  onPick: (exercise: Exercise) => void
}) {
  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[80dvh]">
        <DrawerHeader>
          <DrawerTitle>Добавить упражнение</DrawerTitle>
          <DrawerDescription>Выберите из справочника</DrawerDescription>
        </DrawerHeader>

        <ul
          className="flex flex-col gap-2 overflow-y-auto px-4 pb-4"
          style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
        >
          {exercises.map((exercise) => (
            <li key={exercise.id}>
              <button
                onClick={() => {
                  onPick(exercise)
                  onOpenChange(false)
                }}
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
              </button>
            </li>
          ))}
        </ul>
      </DrawerContent>
    </Drawer>
  )
}
