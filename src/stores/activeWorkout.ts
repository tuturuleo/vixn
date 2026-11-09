import { create } from 'zustand'
import { sessionsRepo } from '@/db/repositories'
import { flatSteps, stepIndex, type Step } from '@/domain/session'
import type {
  MetricType,
  SetResult,
  WorkoutSession,
} from '@/domain/schemas'

// Debounced persistence: value edits fire on every keystroke, navigation is
// saved immediately. Either way the in-progress session survives a reload.
let saveTimer: ReturnType<typeof setTimeout> | null = null
let pendingSession: WorkoutSession | null = null

function cancelPendingSave() {
  if (saveTimer !== null) clearTimeout(saveTimer)
  saveTimer = null
  pendingSession = null
}

export async function flushPendingSave(): Promise<void> {
  const session = pendingSession
  cancelPendingSave()
  if (session) await sessionsRepo.save(session)
}

function persist(session: WorkoutSession, immediate: boolean) {
  cancelPendingSave()
  if (immediate) void sessionsRepo.save(session)
  else {
    pendingSession = session
    saveTimer = setTimeout(() => void flushPendingSave(), 400)
  }
}

/** Replaces one set within a session, returning a new session object. */
function mapSet(
  session: WorkoutSession,
  { entryIndex, setIndex }: Step,
  fn: (set: SetResult) => SetResult,
): WorkoutSession {
  const entries = session.entries.map((entry, ei) =>
    ei === entryIndex
      ? {
          ...entry,
          sets: entry.sets.map((set, si) => (si === setIndex ? fn(set) : set)),
        }
      : entry,
  )
  return { ...session, entries }
}

/** Copies the previous set's values into the target set if it is still empty. */
function prefillFromPrevious(
  session: WorkoutSession,
  cursor: Step,
): WorkoutSession {
  const set = session.entries[cursor.entryIndex]?.sets[cursor.setIndex]
  if (!set || Object.keys(set.values).length > 0 || cursor.setIndex === 0) {
    return session
  }
  const prev = session.entries[cursor.entryIndex].sets[cursor.setIndex - 1]
  if (!prev || Object.keys(prev.values).length === 0) return session
  return mapSet(session, cursor, (s) => ({ ...s, values: { ...prev.values } }))
}

interface ActiveWorkoutState {
  session: WorkoutSession | null
  hydrated: boolean
  /** Load any in-progress session from storage (resume). */
  loadActive: () => Promise<void>
  /** Begin recording a freshly built session. */
  start: (session: WorkoutSession) => Promise<void>
  setMetric: (cursor: Step, metric: MetricType, value: number | null) => void
  goTo: (cursor: Step) => void
  next: () => void
  prev: () => void
  /** Mark complete, persist, clear from the store; returns the saved session. */
  complete: () => Promise<WorkoutSession | null>
  discard: () => Promise<void>
}

export const useActiveWorkout = create<ActiveWorkoutState>((set, get) => ({
  session: null,
  hydrated: false,

  async loadActive() {
    const session = await sessionsRepo.getActive()
    set({ session, hydrated: true })
  },

  async start(session) {
    cancelPendingSave()
    await sessionsRepo.save(session)
    set({ session, hydrated: true })
  },

  setMetric(cursor, metric, value) {
    const session = get().session
    if (!session) return
    const updated = mapSet(session, cursor, (s) => {
      const values = { ...s.values }
      if (value === null) delete values[metric]
      else values[metric] = value
      return { ...s, values }
    })
    set({ session: updated })
    persist(updated, false)
  },

  goTo(cursor) {
    const session = get().session
    if (!session) return
    const updated = prefillFromPrevious(
      { ...session, cursor },
      cursor,
    )
    set({ session: updated })
    persist(updated, true)
  },

  next() {
    const session = get().session
    if (!session) return
    const steps = flatSteps(session)
    const i = stepIndex(session, session.cursor)
    if (i < 0 || i >= steps.length - 1) return
    get().goTo(steps[i + 1])
  },

  prev() {
    const session = get().session
    if (!session) return
    const steps = flatSteps(session)
    const i = stepIndex(session, session.cursor)
    if (i <= 0) return
    get().goTo(steps[i - 1])
  },

  async complete() {
    cancelPendingSave()
    const session = get().session
    if (!session) return null
    const completed: WorkoutSession = {
      ...session,
      status: 'completed',
      finishedAt: Date.now(),
    }
    await sessionsRepo.save(completed)
    set({ session: null })
    return completed
  },

  async discard() {
    cancelPendingSave()
    const session = get().session
    if (session) await sessionsRepo.remove(session.id)
    set({ session: null })
  },
}))
