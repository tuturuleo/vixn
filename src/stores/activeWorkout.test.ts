import { describe, it, expect, beforeEach } from 'vitest'
import { useActiveWorkout } from './activeWorkout'
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
})
