import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/workout/start')({
  component: WorkoutStartPage,
})

function WorkoutStartPage() {
  return (
    <>
      <PageHeader title="Начать тренировку" subtitle="Выберите тренировку" />
      <p className="text-sm text-muted-foreground">Скоро: выбор шаблона.</p>
    </>
  )
}
