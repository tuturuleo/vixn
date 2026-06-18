import localforage from 'localforage'
import type { ZodType } from 'zod'

export const DB_NAME = 'vixn'
export const SCHEMA_VERSION = 1

type Store = ReturnType<typeof localforage.createInstance>

const createStore = (storeName: string): Store =>
  localforage.createInstance({ name: DB_NAME, storeName })

export const stores = {
  exercises: createStore('exercises'),
  templates: createStore('templates'),
  sessions: createStore('sessions'),
  meta: createStore('meta'),
}

/**
 * A validated key/value collection over a localforage store. Every read is
 * re-validated with the entity's zod schema; corrupt or outdated records are
 * skipped on `list` and treated as missing on `get`, so a bad row in IndexedDB
 * can never crash the UI.
 */
export function createCollection<T extends { id: string }>(
  store: Store,
  schema: ZodType<T>,
) {
  return {
    async list(): Promise<T[]> {
      const out: T[] = []
      await store.iterate<unknown, void>((value) => {
        const parsed = schema.safeParse(value)
        if (parsed.success) out.push(parsed.data)
      })
      return out
    },
    async get(id: string): Promise<T | null> {
      const raw = await store.getItem<unknown>(id)
      if (raw == null) return null
      const parsed = schema.safeParse(raw)
      return parsed.success ? parsed.data : null
    },
    async put(item: T): Promise<T> {
      const valid = schema.parse(item)
      await store.setItem(valid.id, valid)
      return valid
    },
    async remove(id: string): Promise<void> {
      await store.removeItem(id)
    },
    async clear(): Promise<void> {
      await store.clear()
    },
  }
}

export type Collection<T extends { id: string }> = ReturnType<
  typeof createCollection<T>
>
