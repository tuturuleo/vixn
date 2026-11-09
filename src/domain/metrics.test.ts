import { describe, it, expect } from 'vitest'
import {
  METRIC_META,
  METRIC_TYPES,
  formatMetricValue,
  formatRecordedValues,
  formatSetLine,
} from './metrics'

describe('METRIC_META', () => {
  it('has an entry for every metric type', () => {
    for (const type of METRIC_TYPES) {
      expect(METRIC_META[type]).toBeDefined()
      expect(METRIC_META[type].type).toBe(type)
    }
    expect(Object.keys(METRIC_META).sort()).toEqual([...METRIC_TYPES].sort())
  })
})

describe('formatMetricValue', () => {
  it('formats weight with one decimal and the kg unit', () => {
    expect(formatMetricValue('weight', 62.5)).toBe('62.5 кг')
    expect(formatMetricValue('weight', 60)).toBe('60 кг')
    expect(formatMetricValue('weight', 60.04)).toBe('60 кг')
  })

  it('rounds reps to an integer without a unit', () => {
    expect(formatMetricValue('reps', 10.4)).toBe('10')
  })

  it('uses seconds for duration and meters for distance', () => {
    expect(formatMetricValue('duration', 30)).toBe('30 сек')
    expect(formatMetricValue('distance', 400)).toBe('400 м')
  })
})

describe('formatSetLine', () => {
  it('joins values of all metrics', () => {
    expect(formatSetLine(['weight', 'reps'], { weight: 60, reps: 10 })).toBe('60 кг · 10')
  })

  it('puts a dash in place of a missing value', () => {
    expect(formatSetLine(['weight', 'reps'], { reps: 10 })).toBe('— · 10')
    expect(formatSetLine(['weight', 'reps'], {})).toBe('— · —')
  })

  it('prints zero as a value, not as a dash', () => {
    expect(formatSetLine(['weight', 'reps'], { weight: 0, reps: 0 })).toBe('0 кг · 0')
  })
})

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
