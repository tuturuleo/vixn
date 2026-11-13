import { describe, it, expect } from 'vitest'
import {
  buildSessionFromExercise,
  buildSessionFromTemplate,
  filledSets,
  normalizeCursor,
  templateSetCount,
  totalSets,
} from './session'
import type { Exercise, WorkoutTemplate } from './schemas'

const bench: Exercise = {
  id: 'ex-bench',
  name: 'Жим лёжа',
  metrics: ['weight', 'reps'],
  archived: false,
  createdAt: 0,
  updatedAt: 0,
}
const pullups: Exercise = {
  id: 'ex-pull',
  name: 'Подтягивания',
  metrics: ['reps'],
  archived: false,
  createdAt: 0,
  updatedAt: 0,
}

const template: WorkoutTemplate = {
  id: 't1',
  name: 'Верх тела',
  items: [
    { exerciseId: 'ex-pull', sets: 2, order: 1 },
    { exerciseId: 'ex-bench', sets: 3, order: 0 },
  ],
  createdAt: 0,
  updatedAt: 0,
}

const exercisesById = { 'ex-bench': bench, 'ex-pull': pullups }

describe('buildSessionFromTemplate', () => {
  const session = buildSessionFromTemplate(template, exercisesById, 1234)

  it('orders entries by template item order', () => {
    expect(session.entries.map((e) => e.exerciseId)).toEqual([
      'ex-bench',
      'ex-pull',
    ])
    expect(session.entries.map((e) => e.order)).toEqual([0, 1])
  })

  it('snapshots exercise name and metrics', () => {
    expect(session.entries[0]).toMatchObject({
      exerciseName: 'Жим лёжа',
      metrics: ['weight', 'reps'],
    })
  })

  it('creates the right number of empty sets per exercise', () => {
    expect(session.entries[0].sets).toHaveLength(3)
    expect(session.entries[1].sets).toHaveLength(2)
    expect(session.entries[0].sets[0]).toEqual({ setIndex: 0, values: {} })
  })

  it('starts in progress with a reset cursor', () => {
    expect(session.status).toBe('in_progress')
    expect(session.startedAt).toBe(1234)
    expect(session.finishedAt).toBeNull()
    expect(session.cursor).toEqual({ entryIndex: 0, setIndex: 0 })
  })

  it('falls back gracefully for a missing exercise', () => {
    const s = buildSessionFromTemplate(
      { ...template, items: [{ exerciseId: 'gone', sets: 1, order: 0 }] },
      {},
    )
    expect(s.entries[0]).toMatchObject({
      exerciseName: 'Упражнение',
      metrics: ['reps'],
    })
  })
})

describe('set counters', () => {
  it('counts total and filled sets', () => {
    const session = buildSessionFromTemplate(template, exercisesById)
    expect(totalSets(session)).toBe(5)
    expect(filledSets(session)).toBe(0)

    session.entries[0].sets[0].values = { weight: 60, reps: 10 }
    expect(filledSets(session)).toBe(1)
  })

  it('counts planned sets in a template', () => {
    expect(templateSetCount(template)).toBe(5)
    expect(templateSetCount({ ...template, items: [] })).toBe(0)
  })
})

describe('normalizeCursor', () => {
  const base = buildSessionFromTemplate(template, exercisesById)

  it('returns the same session for a valid cursor', () => {
    const s = { ...base, cursor: { entryIndex: 1, setIndex: 1 } }
    expect(normalizeCursor(s)).toBe(s)
  })

  it('moves an out-of-range entry index to the last step', () => {
    const s = { ...base, cursor: { entryIndex: 5, setIndex: 9 } }
    expect(normalizeCursor(s).cursor).toEqual({ entryIndex: 1, setIndex: 1 })
  })

  it('clamps an out-of-range set index to the last set of the entry', () => {
    const s = { ...base, cursor: { entryIndex: 0, setIndex: 7 } }
    expect(normalizeCursor(s).cursor).toEqual({ entryIndex: 0, setIndex: 2 })
  })

  it('skips to the next entry with sets when the entry has none', () => {
    const s = {
      ...base,
      entries: [{ ...base.entries[0], sets: [] }, base.entries[1]],
      cursor: { entryIndex: 0, setIndex: 0 },
    }
    expect(normalizeCursor(s).cursor).toEqual({ entryIndex: 1, setIndex: 0 })
  })

  it('resets the cursor when there are no entries', () => {
    const s = { ...base, entries: [], cursor: { entryIndex: 3, setIndex: 4 } }
    expect(normalizeCursor(s).cursor).toEqual({ entryIndex: 0, setIndex: 0 })
  })
})


describe('buildSessionFromExercise', () => {
  it.each([1, 2, 3, 20])('builds one independent snapshot with %s empty sets', (sets) => {
    const exercise = { ...bench, metrics: [...bench.metrics] }
    const session = buildSessionFromExercise(exercise, sets, 1234)
    expect(session).toEqual({
      id: expect.any(String), templateId: null, templateName: 'Упражнение: Жим лёжа',
      status: 'in_progress', startedAt: 1234, finishedAt: null,
      cursor: { entryIndex: 0, setIndex: 0 },
      entries: [{
        exerciseId: bench.id, exerciseName: bench.name, metrics: bench.metrics,
        order: 0, sets: Array.from({ length: sets }, (_, setIndex) => ({ setIndex, values: {} })),
      }],
    })
    expect(session.id).not.toBe(buildSessionFromExercise(exercise, sets).id)
    exercise.name = 'Изменено'
    exercise.metrics.pop()
    expect(session.entries[0].exerciseName).toBe(bench.name)
    expect(session.entries[0].metrics).toEqual(bench.metrics)
    if (sets > 1) {
      session.entries[0].sets[0].values.reps = 10
      expect(session.entries[0].sets[1].values).toEqual({})
    }
  })

  it.each([0, -1, 21, 1.5, NaN, Infinity])('rejects invalid set count %s', (sets) => {
    expect(() => buildSessionFromExercise(bench, sets)).toThrow(RangeError)
  })
})
