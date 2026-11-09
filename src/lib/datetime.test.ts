import { describe, it, expect } from 'vitest'
import { formatDate, formatDateTime, formatDuration } from './datetime'

const MIN = 60_000

describe('formatDuration', () => {
  it('clamps zero and negative durations to 0 minutes', () => {
    expect(formatDuration(0)).toBe('0 мин')
    expect(formatDuration(-5 * MIN)).toBe('0 мин')
  })

  it('shows only minutes below an hour', () => {
    expect(formatDuration(59 * MIN)).toBe('59 мин')
  })

  it('shows hours with zero-padded minutes from an hour on', () => {
    expect(formatDuration(60 * MIN)).toBe('1 ч 00 мин')
    expect(formatDuration(125 * MIN)).toBe('2 ч 05 мин')
  })

  it('rounds to the nearest minute', () => {
    expect(formatDuration(29_999)).toBe('0 мин')
    expect(formatDuration(30_000)).toBe('1 мин')
  })
})

// Exact output depends on the time zone and ICU data, so only check stable parts.
const MIDDAY = new Date(2025, 5, 15, 12).getTime()

describe('formatDate', () => {
  it('includes the day and the year', () => {
    const s = formatDate(MIDDAY)
    expect(s).toContain('2025')
    expect(s).toContain('15')
  })
})

describe('formatDateTime', () => {
  it('includes the day and the time', () => {
    const s = formatDateTime(MIDDAY)
    expect(s).toContain('15')
    expect(s).toContain('12:00')
  })
})
