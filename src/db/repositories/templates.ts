import { createCollection, stores } from '../storage'
import {
  workoutTemplateSchema,
  type WorkoutTemplate,
} from '@/domain/schemas'
import { newId } from '@/lib/id'

const col = createCollection(stores.templates, workoutTemplateSchema)

const byUpdated = (a: WorkoutTemplate, b: WorkoutTemplate) =>
  b.updatedAt - a.updatedAt

/** One item as supplied by the UI; `order` is assigned from array position. */
export interface TemplateItemInput {
  exerciseId: string
  sets: number
}

export interface TemplateInput {
  name: string
  items: TemplateItemInput[]
}

const withOrder = (items: TemplateItemInput[]) =>
  items.map((item, order) => ({
    exerciseId: item.exerciseId,
    sets: item.sets,
    order,
  }))

export const templatesRepo = {
  async list(): Promise<WorkoutTemplate[]> {
    return (await col.list()).sort(byUpdated)
  },

  get(id: string): Promise<WorkoutTemplate | null> {
    return col.get(id)
  },

  async create(input: TemplateInput): Promise<WorkoutTemplate> {
    const now = Date.now()
    return col.put({
      id: newId(),
      name: input.name.trim(),
      items: withOrder(input.items),
      createdAt: now,
      updatedAt: now,
    })
  },

  async update(id: string, input: TemplateInput): Promise<WorkoutTemplate> {
    const current = await col.get(id)
    if (!current) throw new Error(`Template not found: ${id}`)
    return col.put({
      ...current,
      name: input.name.trim(),
      items: withOrder(input.items),
      updatedAt: Date.now(),
    })
  },

  remove(id: string): Promise<void> {
    return col.remove(id)
  },
}
