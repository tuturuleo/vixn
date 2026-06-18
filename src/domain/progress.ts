import { METRIC_TYPES, type MetricType } from './metrics'
import type { WorkoutSession } from './schemas'

const sessionTime = (s: WorkoutSession) => s.finishedAt ?? s.startedAt
const metricOrder = (a: MetricType, b: MetricType) =>
  METRIC_TYPES.indexOf(a) - METRIC_TYPES.indexOf(b)

export interface ExerciseStat {
  id: string
  name: string
  /** Metrics that actually have recorded values, in canonical order. */
  metrics: MetricType[]
}

/**
 * Every exercise that appears with recorded data across the given sessions,
 * regardless of which template it came from — this is what powers the
 * cross-workout "by exercise" progress view.
 */
export function collectExerciseStats(
  sessions: WorkoutSession[],
): ExerciseStat[] {
  const map = new Map<
    string,
    { name: string; metrics: Set<MetricType>; last: number }
  >()

  for (const session of sessions) {
    const t = sessionTime(session)
    for (const entry of session.entries) {
      const recorded = entry.sets.some(
        (s) => Object.keys(s.values).length > 0,
      )
      if (!recorded) continue

      const cur =
        map.get(entry.exerciseId) ??
        { name: entry.exerciseName, metrics: new Set<MetricType>(), last: 0 }
      if (t >= cur.last) {
        cur.name = entry.exerciseName // newest name wins
        cur.last = t
      }
      for (const set of entry.sets) {
        for (const m of Object.keys(set.values) as MetricType[]) {
          cur.metrics.add(m)
        }
      }
      map.set(entry.exerciseId, cur)
    }
  }

  return [...map.entries()]
    .map(([id, v]) => ({
      id,
      name: v.name,
      metrics: [...v.metrics].sort(metricOrder),
    }))
    .sort((a, b) => a.name.localeCompare(b.name, 'ru'))
}

export interface ProgressPoint {
  date: number
  /** Best (max) value of the metric recorded in that session. */
  value: number
}

/** Time series of an exercise's best set per session for one metric. */
export function buildSeries(
  sessions: WorkoutSession[],
  exerciseId: string,
  metric: MetricType,
): ProgressPoint[] {
  const points: ProgressPoint[] = []

  for (const session of [...sessions].sort(
    (a, b) => sessionTime(a) - sessionTime(b),
  )) {
    let best: number | null = null
    for (const entry of session.entries) {
      if (entry.exerciseId !== exerciseId) continue
      for (const set of entry.sets) {
        const v = set.values[metric]
        if (v != null) best = best === null ? v : Math.max(best, v)
      }
    }
    if (best !== null) points.push({ date: sessionTime(session), value: best })
  }

  return points
}
