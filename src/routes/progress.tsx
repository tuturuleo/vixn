import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/progress')({
  component: ProgressPage,
})

function ProgressPage() {
  return (
    <>
      <PageHeader title="Прогресс" subtitle="Динамика по упражнениям" />
      <p className="text-sm text-muted-foreground">Скоро: графики прогресса.</p>
    </>
  )
}
