import { describe, it, expect } from 'vitest'
import {
  exerciseSchema,
  setResultSchema,
  workoutSessionSchema,
} from './schemas'

describe('exerciseSchema', () => {
  const base = {
    id: 'e1',
    name: 'Жим лёжа',
    metrics: ['weight', 'reps'],
    archived: false,
    createdAt: 1,
    updatedAt: 1,
  }

  it('accepts a valid exercise', () => {
    expect(exerciseSchema.parse(base)).toMatchObject({ name: 'Жим лёжа' })
  })

  it('rejects an empty metrics list', () => {
    expect(exerciseSchema.safeParse({ ...base, metrics: [] }).success).toBe(
      false,
    )
  })

  it('rejects an unknown metric', () => {
    expect(
      exerciseSchema.safeParse({ ...base, metrics: ['power'] }).success,
    ).toBe(false)
  })
})

describe('setResultSchema', () => {
  it('allows a partial subset of metric values', () => {
    const parsed = setResultSchema.parse({
      setIndex: 0,
      values: { reps: 10 },
    })
    expect(parsed.values).toEqual({ reps: 10 })
  })

  it('rejects negative values', () => {
    expect(
      setResultSchema.safeParse({ setIndex: 0, values: { weight: -5 } })
        .success,
    ).toBe(false)
  })
})

describe('workoutSessionSchema', () => {
  it('allows a null finishedAt while in progress', () => {
    const session = {
      id: 's1',
      templateId: 't1',
      templateName: 'Грудь',
      status: 'in_progress',
      startedAt: 100,
      finishedAt: null,
      entries: [],
      cursor: { entryIndex: 0, setIndex: 0 },
    }
    expect(workoutSessionSchema.parse(session).finishedAt).toBeNull()
  })
})
