import { describe, it, expect } from 'vitest'
import { setsWord } from './plural'

describe('setsWord', () => {
  it.each([
    [1, 'подход'],
    [2, 'подхода'],
    [3, 'подхода'],
    [4, 'подхода'],
    [5, 'подходов'],
    [11, 'подходов'],
    [12, 'подходов'],
    [21, 'подход'],
    [22, 'подхода'],
    [25, 'подходов'],
    [100, 'подходов'],
    [101, 'подход'],
  ])('%i → %s', (n, word) => {
    expect(setsWord(n)).toBe(word)
  })
})
