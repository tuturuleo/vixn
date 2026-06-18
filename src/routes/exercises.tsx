import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/exercises')({
  component: ExercisesPage,
})

function ExercisesPage() {
  return (
    <>
      <PageHeader title="Упражнения" subtitle="Справочник упражнений" />
      <p className="text-sm text-muted-foreground">Скоро: библиотека упражнений.</p>
    </>
  )
}
