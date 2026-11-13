import { newId } from '@/lib/id'
import type {
  Exercise,
  WorkoutSession,
  WorkoutTemplate,
} from './schemas'

/** Builds a standalone session without creating a workout template. */
export function buildSessionFromExercise(
  exercise: Exercise,
  sets: number,
  now: number = Date.now(),
): WorkoutSession {
  if (!Number.isInteger(sets) || sets < 1 || sets > 20) {
    throw new RangeError('Количество подходов должно быть целым числом от 1 до 20')
  }
  return {
    id: newId(),
    templateId: null,
    templateName: `Упражнение: ${exercise.name}`,
    status: 'in_progress',
    startedAt: now,
    finishedAt: null,
    entries: [{
      exerciseId: exercise.id,
      exerciseName: exercise.name,
      metrics: [...exercise.metrics],
      order: 0,
      sets: Array.from({ length: sets }, (_, setIndex) => ({ setIndex, values: {} })),
    }],
    cursor: { entryIndex: 0, setIndex: 0 },
  }
}

/**
 * Builds a fresh in-progress session from a template, snapshotting each
 * exercise's name and metric config so the recorded history stays stable even
 * if the exercise or template is later edited or archived.
 */
export function buildSessionFromTemplate(
  template: WorkoutTemplate,
  exercisesById: Record<string, Exercise>,
  now: number = Date.now(),
): WorkoutSession {
  const entries = [...template.items]
    .sort((a, b) => a.order - b.order)
    .map((item, order) => {
      const exercise = exercisesById[item.exerciseId]
      return {
        exerciseId: item.exerciseId,
        exerciseName: exercise?.name ?? 'Упражнение',
        metrics: exercise?.metrics ?? (['reps'] as const).slice(),
        order,
        sets: Array.from({ length: item.sets }, (_, setIndex) => ({
          setIndex,
          values: {},
        })),
      }
    })

  return {
    id: newId(),
    templateId: template.id,
    templateName: template.name,
    status: 'in_progress',
    startedAt: now,
    finishedAt: null,
    entries,
    cursor: { entryIndex: 0, setIndex: 0 },
  }
}

/** Total number of sets across all exercises in a session. */
export function totalSets(session: WorkoutSession): number {
  return session.entries.reduce((sum, e) => sum + e.sets.length, 0)
}

/** Total number of planned sets across all items in a template. */
export function templateSetCount(template: WorkoutTemplate): number {
  return template.items.reduce((sum, i) => sum + i.sets, 0)
}

/** Count of sets that have at least one recorded value. */
export function filledSets(session: WorkoutSession): number {
  return session.entries.reduce(
    (sum, e) =>
      sum + e.sets.filter((s) => Object.keys(s.values).length > 0).length,
    0,
  )
}

export interface Step {
  entryIndex: number
  setIndex: number
}

/** Flattens the session into a linear list of (exercise, set) steps. */
export function flatSteps(session: WorkoutSession): Step[] {
  const steps: Step[] = []
  session.entries.forEach((entry, entryIndex) => {
    entry.sets.forEach((_, setIndex) => steps.push({ entryIndex, setIndex }))
  })
  return steps
}

/** 0-based position of a cursor within the flat step list (-1 if absent). */
export function stepIndex(session: WorkoutSession, cursor: Step): number {
  return flatSteps(session).findIndex(
    (s) => s.entryIndex === cursor.entryIndex && s.setIndex === cursor.setIndex,
  )
}

/**
 * Clamps a possibly corrupt cursor onto an existing step. Returns the same
 * session object when the cursor already addresses a real set.
 */
export function normalizeCursor(session: WorkoutSession): WorkoutSession {
  const { entryIndex, setIndex } = session.cursor
  const entry = session.entries[entryIndex]
  if (entry?.sets[setIndex]) return session

  const steps = flatSteps(session)
  let target: Step = { entryIndex: 0, setIndex: 0 }
  if (steps.length > 0) {
    target = steps[steps.length - 1]
    if (entry) {
      target =
        entry.sets.length > 0
          ? { entryIndex, setIndex: entry.sets.length - 1 }
          : (steps.find((s) => s.entryIndex > entryIndex) ?? target)
    }
  }

  if (target.entryIndex === entryIndex && target.setIndex === setIndex) {
    return session
  }
  return { ...session, cursor: target }
}
