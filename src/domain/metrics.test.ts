import { describe, it, expect } from 'vitest'
import { formatRecordedValues } from './metrics'

describe('formatRecordedValues', () => {
  it('joins all recorded values', () => {
    expect(formatRecordedValues(['weight', 'reps'], { weight: 60, reps: 10 })).toBe(
      '60 кг · 10',
    )
  })

  it('skips missing values', () => {
    expect(formatRecordedValues(['weight', 'reps'], { reps: 10 })).toBe('10')
    expect(
      formatRecordedValues(['weight', 'reps', 'duration'], {
        weight: 62.5,
        duration: 30,
      }),
    ).toBe('62.5 кг · 30 сек')
  })

  it('returns an empty string when nothing is recorded', () => {
    expect(formatRecordedValues(['weight', 'reps'], {})).toBe('')
  })
})
