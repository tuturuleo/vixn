import { z } from 'zod'
import {
  exerciseSchema,
  workoutTemplateSchema,
  workoutSessionSchema,
} from '@/domain/schemas'
import { createCollection, SCHEMA_VERSION, stores, type Collection } from './storage'

export const backupSchema = z.object({
  app: z.literal('vixn'),
  schemaVersion: z.number().int(),
  exportedAt: z.number(),
  exercises: z.array(exerciseSchema),
  templates: z.array(workoutTemplateSchema),
  sessions: z.array(workoutSessionSchema),
})

export type Backup = z.infer<typeof backupSchema>

const exercises = createCollection(stores.exercises, exerciseSchema)
const templates = createCollection(stores.templates, workoutTemplateSchema)
const sessions = createCollection(stores.sessions, workoutSessionSchema)

function validateBackup(value: unknown): Backup {
  const result = backupSchema.safeParse(value)
  if (!result.success) {
    throw new Error('Некорректный формат резервной копии vixn или повреждённые записи.')
  }
  if (result.data.schemaVersion > SCHEMA_VERSION) {
    throw new Error('Резервная копия создана в более новой версии vixn. Обновите приложение.')
  }
  return result.data
}

export async function exportAll(): Promise<Backup> {
  const [allExercises, allTemplates, allSessions] = await Promise.all([
    exercises.list(),
    templates.list(),
    sessions.list(),
  ])
  return {
    app: 'vixn',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: Date.now(),
    exercises: allExercises,
    templates: allTemplates,
    sessions: allSessions,
  }
}

export function serializeBackup(backup: Backup): string {
  return JSON.stringify(backup, null, 2)
}

export function parseBackup(text: string): Backup {
  let value: unknown
  try {
    value = JSON.parse(text)
  } catch {
    throw new Error('Не удалось прочитать JSON. Выберите файл резервной копии vixn.')
  }
  return validateBackup(value)
}

export async function importAll(
  backup: Backup,
): Promise<{ added: number; updated: number; skipped: number }> {
  // Validate every entity before the first write, including direct API calls.
  const valid = validateBackup(backup)
  const counts = { added: 0, updated: 0, skipped: 0 }

  async function merge<T extends { id: string }>(
    collection: Collection<T>,
    incoming: T[],
    isNewer: (next: T, current: T) => boolean,
  ) {
    for (const item of incoming) {
      const current = await collection.get(item.id)
      if (!current) {
        await collection.put(item)
        counts.added++
      } else if (isNewer(item, current)) {
        await collection.put(item)
        counts.updated++
      } else {
        counts.skipped++
      }
    }
  }

  await merge(exercises, valid.exercises, (next, current) => next.updatedAt > current.updatedAt)
  await merge(templates, valid.templates, (next, current) => next.updatedAt > current.updatedAt)
  await merge(sessions, valid.sessions, (next, current) => {
    if (next.status !== current.status) return next.status === 'completed'
    return (next.finishedAt ?? next.startedAt) > (current.finishedAt ?? current.startedAt)
  })
  return counts
}
