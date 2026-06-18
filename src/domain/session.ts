import { newId } from '@/lib/id'
import type {
  Exercise,
  WorkoutSession,
  WorkoutTemplate,
} from './schemas'

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

/** Count of sets that have at least one recorded value. */
export function filledSets(session: WorkoutSession): number {
  return session.entries.reduce(
    (sum, e) =>
      sum + e.sets.filter((s) => Object.keys(s.values).length > 0).length,
    0,
  )
}
