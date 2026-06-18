import { createCollection, stores } from '../storage'
import {
  workoutSessionSchema,
  type WorkoutSession,
} from '@/domain/schemas'

const col = createCollection(stores.sessions, workoutSessionSchema)

export const sessionsRepo = {
  get(id: string): Promise<WorkoutSession | null> {
    return col.get(id)
  },

  /** Persist the full session (used for create + every autosave step). */
  save(session: WorkoutSession): Promise<WorkoutSession> {
    return col.put(session)
  },

  /** The current unfinished workout, if any (most recently started wins). */
  async getActive(): Promise<WorkoutSession | null> {
    const all = await col.list()
    const active = all
      .filter((s) => s.status === 'in_progress')
      .sort((a, b) => b.startedAt - a.startedAt)
    return active[0] ?? null
  },

  /** Completed sessions, newest finished first — the workout history. */
  async listCompleted(): Promise<WorkoutSession[]> {
    const all = await col.list()
    return all
      .filter((s) => s.status === 'completed')
      .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0))
  },

  remove(id: string): Promise<void> {
    return col.remove(id)
  },
}
