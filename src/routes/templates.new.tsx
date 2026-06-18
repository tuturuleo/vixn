import { createFileRoute } from '@tanstack/react-router'
import { TemplateEditor } from '@/features/templates/TemplateEditor'
import { templatesRepo, exercisesRepo, type TemplateInput } from '@/db/repositories'

export const Route = createFileRoute('/templates/new')({
  loader: () => exercisesRepo.list(),
  component: NewTemplatePage,
})

function NewTemplatePage() {
  const exercises = Route.useLoaderData()

  const handleSave = async (input: TemplateInput) => {
    await templatesRepo.create(input)
  }

  return (
    <TemplateEditor
      title="Новая тренировка"
      exercises={exercises}
      onSave={handleSave}
    />
  )
}
