import { createFileRoute } from '@tanstack/react-router'
import { PageHeader } from '@/components/layout/PageHeader'

export const Route = createFileRoute('/templates')({
  component: TemplatesPage,
})

function TemplatesPage() {
  return (
    <>
      <PageHeader title="Тренировки" subtitle="Виды тренировок и упражнения" />
      <p className="text-sm text-muted-foreground">Скоро: список шаблонов.</p>
    </>
  )
}
