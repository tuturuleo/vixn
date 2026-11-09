import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPendingSave, useActiveWorkout } from './activeWorkout'
import { buildSessionFromTemplate } from '@/domain/session'
import { sessionsRepo } from '@/db/repositories'
import { stores } from '@/db/storage'
import type { Exercise, WorkoutTemplate } from '@/domain/schemas'

const bench: Exercise = {
  id: 'ex1',
  name: 'Жим',
  metrics: ['weight', 'reps'],
  archived: false,
  createdAt: 0,
  updatedAt: 0,
}
const template: WorkoutTemplate = {
  id: 't1',
  name: 'Грудь',
  items: [{ exerciseId: 'ex1', sets: 3, order: 0 }],
  createdAt: 0,
  updatedAt: 0,
}

const freshSession = () => buildSessionFromTemplate(template, { ex1: bench }, 1)

beforeEach(async () => {
  await stores.sessions.clear()
  useActiveWorkout.setState({ session: null, hydrated: false })
})

afterEach(async () => {
  try {
    await flushPendingSave()
  } finally {
    vi.useRealTimers()
  }
})

describe('activeWorkout store', () => {
  it('start persists and exposes the session', async () => {
    await useActiveWorkout.getState().start(freshSession())
    expect(useActiveWorkout.getState().session?.templateName).toBe('Грудь')
    expect(await sessionsRepo.getActive()).not.toBeNull()
  })

  it('setMetric writes a value into the addressed set', async () => {
    await useActiveWorkout.getState().start(freshSession())
    useActiveWorkout
      .getState()
      .setMetric({ entryIndex: 0, setIndex: 0 }, 'weight', 60)

    const s = useActiveWorkout.getState().session!
    expect(s.entries[0].sets[0].values).toEqual({ weight: 60 })
  })

  it('next advances the cursor and prefills from the previous set', async () => {
    const store = useActiveWorkout.getState()
    await store.start(freshSession())
    store.setMetric({ entryIndex: 0, setIndex: 0 }, 'weight', 60)
    store.setMetric({ entryIndex: 0, setIndex: 0 }, 'reps', 10)
    store.next()

    const s = useActiveWorkout.getState().session!
    expect(s.cursor).toEqual({ entryIndex: 0, setIndex: 1 })
    expect(s.entries[0].sets[1].values).toEqual({ weight: 60, reps: 10 })
  })

  it('prev does not move past the first step', async () => {
    const store = useActiveWorkout.getState()
    await store.start(freshSession())
    store.prev()
    expect(useActiveWorkout.getState().session!.cursor).toEqual({
      entryIndex: 0,
      setIndex: 0,
    })
  })

  it('complete marks the session done and clears it from the store', async () => {
    const store = useActiveWorkout.getState()
    await store.start(freshSession())
    const done = await useActiveWorkout.getState().complete()

    expect(done?.status).toBe('completed')
    expect(done?.finishedAt).toBeGreaterThan(0)
    expect(useActiveWorkout.getState().session).toBeNull()
    expect(await sessionsRepo.getActive()).toBeNull()
    expect(await sessionsRepo.listCompleted()).toHaveLength(1)
  })

  it('complete cancels a pending metric save', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const store = useActiveWorkout.getState()
    await store.start(freshSession())
    store.setMetric({ entryIndex: 0, setIndex: 2 }, 'weight', 60)

    await store.complete()
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()

    expect(await sessionsRepo.getActive()).toBeNull()
    const completed = await sessionsRepo.listCompleted()
    expect(completed).toHaveLength(1)
    expect(completed[0].status).toBe('completed')
    expect(completed[0].entries[0].sets[2].values.weight).toBe(60)
  })

  it('discard cancels a pending metric save', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const store = useActiveWorkout.getState()
    const session = freshSession()
    await store.start(session)
    store.setMetric({ entryIndex: 0, setIndex: 2 }, 'weight', 60)

    await store.discard()
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()

    expect(await sessionsRepo.get(session.id)).toBeNull()
  })

  it('flushPendingSave immediately persists the latest pending session', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const store = useActiveWorkout.getState()
    const session = freshSession()
    await store.start(session)
    store.setMetric({ entryIndex: 0, setIndex: 0 }, 'weight', 60)
    store.setMetric({ entryIndex: 0, setIndex: 0 }, 'weight', 65)
    store.setMetric({ entryIndex: 0, setIndex: 0 }, 'reps', 10)

    await flushPendingSave()

    const saved = await sessionsRepo.get(session.id)
    expect(saved?.entries[0].sets[0].values).toEqual({ weight: 65, reps: 10 })
    expect(vi.getTimerCount()).toBe(0)
  })

  it('start cancels the previous session\'s pending metric save', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const store = useActiveWorkout.getState()
    const previous = freshSession()
    await store.start(previous)
    store.setMetric({ entryIndex: 0, setIndex: 0 }, 'weight', 60)

    const next = freshSession()
    await store.start(next)
    await flushPendingSave()
    vi.advanceTimersByTime(1000)
    await vi.runAllTimersAsync()

    expect(await sessionsRepo.get(next.id)).toEqual(next)
    expect(await sessionsRepo.get(previous.id)).toEqual(previous)
  })

  it('loadActive repairs an out-of-range cursor and persists it', async () => {
    const broken = {
      ...freshSession(),
      cursor: { entryIndex: 5, setIndex: 9 },
    }
    await stores.sessions.setItem(broken.id, broken)

    await useActiveWorkout.getState().loadActive()

    const s = useActiveWorkout.getState().session!
    expect(s.cursor).toEqual({ entryIndex: 0, setIndex: 2 })
    expect(s.entries[s.cursor.entryIndex].sets[s.cursor.setIndex]).toBeDefined()
    expect((await sessionsRepo.get(broken.id))?.cursor).toEqual(s.cursor)
  })
})
