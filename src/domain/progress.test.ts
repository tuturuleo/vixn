import { describe, it, expect } from 'vitest'
import { collectExerciseStats, buildSeries } from './progress'
import type { WorkoutSession } from './schemas'

const session = (
  id: string,
  finishedAt: number,
  entries: WorkoutSession['entries'],
): WorkoutSession => ({
  id,
  templateId: 't',
  templateName: 'T',
  status: 'completed',
  startedAt: finishedAt - 1000,
  finishedAt,
  entries,
  cursor: { entryIndex: 0, setIndex: 0 },
})

const sessions: WorkoutSession[] = [
  session('s2', 2000, [
    {
      exerciseId: 'bench',
      exerciseName: 'Жим лёжа',
      metrics: ['weight', 'reps'],
      order: 0,
      sets: [
        { setIndex: 0, values: { weight: 62.5, reps: 8 } },
        { setIndex: 1, values: { weight: 60, reps: 10 } },
      ],
    },
  ]),
  session('s1', 1000, [
    {
      exerciseId: 'bench',
      exerciseName: 'Жим',
      metrics: ['weight', 'reps'],
      order: 0,
      sets: [{ setIndex: 0, values: { weight: 60, reps: 10 } }],
    },
    {
      exerciseId: 'empty',
      exerciseName: 'Пустое',
      metrics: ['reps'],
      order: 1,
      sets: [{ setIndex: 0, values: {} }],
    },
  ]),
]

describe('collectExerciseStats', () => {
  const stats = collectExerciseStats(sessions)

  it('lists only exercises with recorded data', () => {
    expect(stats.map((s) => s.id)).toEqual(['bench'])
  })

  it('uses the most recent name and canonical metric order', () => {
    expect(stats[0]).toEqual({
      id: 'bench',
      name: 'Жим лёжа',
      metrics: ['weight', 'reps'],
    })
  })
})

describe('buildSeries', () => {
  it('returns the best value per session in chronological order', () => {
    expect(buildSeries(sessions, 'bench', 'weight')).toEqual([
      { date: 1000, value: 60 },
      { date: 2000, value: 62.5 },
    ])
  })

  it('is empty for a metric that was never recorded', () => {
    expect(buildSeries(sessions, 'bench', 'distance')).toEqual([])
  })
})
