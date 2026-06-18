import { createCollection, stores } from '../storage'
import { exerciseSchema, type Exercise } from '@/domain/schemas'
import type { MetricType } from '@/domain/metrics'
import { newId } from '@/lib/id'

const col = createCollection(stores.exercises, exerciseSchema)

const byName = (a: Exercise, b: Exercise) =>
  a.name.localeCompare(b.name, 'ru')

export interface ExerciseInput {
  name: string
  metrics: MetricType[]
}

export const exercisesRepo = {
  /** Active (non-archived) exercises, sorted by name. */
  async list(): Promise<Exercise[]> {
    const all = await col.list()
    return all.filter((e) => !e.archived).sort(byName)
  },

  /** Everything including archived, sorted by name. */
  async listAll(): Promise<Exercise[]> {
    return (await col.list()).sort(byName)
  },

  get(id: string): Promise<Exercise | null> {
    return col.get(id)
  },

  async create(input: ExerciseInput): Promise<Exercise> {
    const now = Date.now()
    return col.put({
      id: newId(),
      name: input.name.trim(),
      metrics: input.metrics,
      archived: false,
      createdAt: now,
      updatedAt: now,
    })
  },

  async update(id: string, patch: Partial<ExerciseInput>): Promise<Exercise> {
    const current = await col.get(id)
    if (!current) throw new Error(`Exercise not found: ${id}`)
    return col.put({
      ...current,
      ...patch,
      name: patch.name?.trim() ?? current.name,
      updatedAt: Date.now(),
    })
  },

  /** Soft-delete: keeps the record so session history stays intact. */
  async archive(id: string): Promise<Exercise> {
    const current = await col.get(id)
    if (!current) throw new Error(`Exercise not found: ${id}`)
    return col.put({ ...current, archived: true, updatedAt: Date.now() })
  },

  async restore(id: string): Promise<Exercise> {
    const current = await col.get(id)
    if (!current) throw new Error(`Exercise not found: ${id}`)
    return col.put({ ...current, archived: false, updatedAt: Date.now() })
  },
}
