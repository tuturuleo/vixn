import { createFileRoute, redirect, useRouter } from '@tanstack/react-router'
import { TemplateEditor } from '@/features/templates/TemplateEditor'
import { templatesRepo, exercisesRepo, type TemplateInput } from '@/db/repositories'

export const Route = createFileRoute('/templates/$templateId')({
  loader: async ({ params }) => {
    const [template, exercises, all] = await Promise.all([
      templatesRepo.get(params.templateId),
      exercisesRepo.list(),
      exercisesRepo.listAll(),
    ])
    if (!template) throw redirect({ to: '/templates' })
    const names = new Map(all.map((e) => [e.id, e.name]))
    const items = [...template.items]
      .sort((a, b) => a.order - b.order)
      .map((i) => ({
        exerciseId: i.exerciseId,
        sets: i.sets,
        name: names.get(i.exerciseId) ?? 'Упражнение',
      }))
    return { template, exercises, items }
  },
  component: EditTemplatePage,
})

function EditTemplatePage() {
  const router = useRouter()
  const { template, exercises, items } = Route.useLoaderData()

  const handleSave = async (input: TemplateInput) => {
    await templatesRepo.update(template.id, input)
    await router.invalidate()
  }
  const handleDelete = async () => {
    await templatesRepo.remove(template.id)
    await router.invalidate()
  }

  return (
    <TemplateEditor
      title="Тренировка"
      exercises={exercises}
      initialName={template.name}
      initialItems={items}
      onSave={handleSave}
      onDelete={handleDelete}
    />
  )
}
