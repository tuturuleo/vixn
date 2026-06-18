import { createFileRoute, Link } from '@tanstack/react-router'
import { Plus, ListChecks, ChevronRight } from 'lucide-react'
import { PageHeader } from '@/components/layout/PageHeader'
import { EmptyState } from '@/components/layout/EmptyState'
import { Button } from '@/components/ui/button'
import { templatesRepo, exercisesRepo } from '@/db/repositories'

export const Route = createFileRoute('/templates/')({
  loader: async () => {
    const [templates, exercises] = await Promise.all([
      templatesRepo.list(),
      exercisesRepo.listAll(),
    ])
    const names = new Map(exercises.map((e) => [e.id, e.name]))
    return { templates, names }
  },
  component: TemplatesPage,
})

function TemplatesPage() {
  const { templates, names } = Route.useLoaderData()

  return (
    <>
      <PageHeader
        title="Тренировки"
        subtitle="Виды тренировок"
        action={
          <Button asChild size="icon" aria-label="Создать">
            <Link to="/templates/new">
              <Plus className="size-5" />
            </Link>
          </Button>
        }
      />

      {templates.length === 0 ? (
        <EmptyState
          icon={ListChecks}
          title="Пока нет тренировок"
          description="Соберите тренировку из упражнений справочника"
          action={
            <Button asChild>
              <Link to="/templates/new">
                <Plus className="size-4" />
                Создать тренировку
              </Link>
            </Button>
          }
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {templates.map((template) => {
            const list = template.items
              .map((i) => names.get(i.exerciseId) ?? 'Упражнение')
              .join(' · ')
            return (
              <li key={template.id}>
                <Link
                  to="/templates/$templateId"
                  params={{ templateId: template.id }}
                  className="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 active:scale-[0.99]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{template.name}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {template.items.length > 0
                        ? list
                        : 'Нет упражнений'}
                    </p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted-foreground" />
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </>
  )
}
