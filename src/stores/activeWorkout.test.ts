import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { flushPendingSave, useActiveWorkout } from './activeWorkout'
import { buildSeries, collectExerciseStats } from '@/domain/progress'
import { buildSessionFromExercise, buildSessionFromTemplate } from '@/domain/session'
import { sessionsRepo } from '@/db/repositories'
import { stores } from '@/db/storage'
import { exportAll } from '@/db/backup'
import { importBackup } from './importBackup'
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
    vi.restoreAllMocks()
  }
})

describe('backup import persistence ordering', () => {
  it('selects the newest active session and normalizes its cursor after import', async () => {
    useActiveWorkout.setState({ hydrated: true, session: null })
    const older = freshSession()
    const newest = { ...freshSession(), startedAt: 2, cursor: { entryIndex: 5, setIndex: 9 } }

    await importBackup({ ...await exportAll(), sessions: [older, newest] })

    const restored = useActiveWorkout.getState().session
    expect(restored?.id).toBe(newest.id)
    expect(restored?.cursor).toEqual({ entryIndex: 0, setIndex: 2 })
    expect(await sessionsRepo.get(newest.id)).toEqual(restored)
  })

  it('flushes the debounce timer before import and never restores the stale version afterwards', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const session = freshSession()
    await useActiveWorkout.getState().start(session)
    const completed = { ...session, status: 'completed' as const, finishedAt: 2 }
    const backup = { ...await exportAll(), sessions: [completed] }
    useActiveWorkout.getState().setMetric(session.cursor, 'weight', 60)

    await importBackup(backup)
    await vi.advanceTimersByTimeAsync(1000)
    await flushPendingSave()

    expect(await sessionsRepo.get(session.id)).toEqual(completed)
    expect(useActiveWorkout.getState().session).toBeNull()
  })

  it.each(['timer', 'navigation'] as const)('waits for an autosave already started by %s', async (source) => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const session = freshSession()
    await useActiveWorkout.getState().start(session)
    const completed = { ...session, status: 'completed' as const, finishedAt: 2 }
    const backup = { ...await exportAll(), sessions: [completed] }
    const save = sessionsRepo.save
    let release!: () => void
    const blocked = new Promise<void>((resolve) => { release = resolve })
    const saveSpy = vi.spyOn(sessionsRepo, 'save').mockImplementationOnce(async (value) => {
      await blocked
      return save(value)
    })
    useActiveWorkout.getState().setMetric(session.cursor, 'weight', 60)
    if (source === 'timer') vi.advanceTimersByTime(400)
    else useActiveWorkout.getState().next()
    await Promise.resolve()
    expect(saveSpy).toHaveBeenCalledTimes(1)

    let imported = false
    const importing = importBackup(backup).then(() => { imported = true })
    await Promise.resolve()
    expect(imported).toBe(false)
    expect((await sessionsRepo.get(session.id))?.status).toBe('in_progress')
    release()
    await importing
    await vi.advanceTimersByTimeAsync(1000)

    expect(await sessionsRepo.get(session.id)).toEqual(completed)
    expect(useActiveWorkout.getState().session).toBeNull()
  })

  it('preserves local edits when merge skips an equally old incoming session', async () => {
    const session = freshSession()
    await useActiveWorkout.getState().start(session)
    const backup = { ...await exportAll(), sessions: [session] }
    useActiveWorkout.getState().setMetric(session.cursor, 'weight', 60)
    const current = useActiveWorkout.getState().session

    expect(await importBackup(backup)).toEqual({ added: 0, updated: 0, skipped: 1 })

    expect(useActiveWorkout.getState().session).toEqual(current)
    expect(await sessionsRepo.get(session.id)).toEqual(current)
  })

  it('keeps the current workout if import rejects a backup after flushing edits', async () => {
    const session = freshSession()
    await useActiveWorkout.getState().start(session)
    const backup = await exportAll()
    useActiveWorkout.getState().setMetric(session.cursor, 'weight', 60)
    const current = useActiveWorkout.getState().session

    await expect(importBackup({ ...backup, schemaVersion: backup.schemaVersion + 1 }))
      .rejects.toThrow('более новой версии')

    expect(useActiveWorkout.getState()).toMatchObject({ hydrated: true, session: current })
    expect(await sessionsRepo.get(session.id)).toEqual(current)
  })
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

  it.each(['complete', 'discard', 'start'] as const)('%s waits for a queued navigation save', async (action) => {
    const store = useActiveWorkout.getState()
    const session = freshSession()
    await store.start(session)
    store.setMetric(session.cursor, 'weight', 60)
    store.next()

    if (action === 'start') await store.start(freshSession())
    else await store[action]()
    await flushPendingSave()

    const previous = await sessionsRepo.get(session.id)
    if (action === 'discard') expect(previous).toBeNull()
    else {
      expect(previous?.status).toBe('completed')
      expect(previous?.entries[0].sets[0].values.weight).toBe(60)
    }
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
    // The cancelled save never landed, so the empty previous session is dropped.
    expect(await sessionsRepo.get(previous.id)).toBeNull()
  })

  it('start removes an empty orphaned in-progress session', async () => {
    const orphan = freshSession()
    await sessionsRepo.save(orphan)

    const next = freshSession()
    await useActiveWorkout.getState().start(next)

    const active = await sessionsRepo.listActive()
    expect(active).toHaveLength(1)
    expect(active[0].id).toBe(next.id)
    expect(await sessionsRepo.get(orphan.id)).toBeNull()
  })

  it('start moves an orphaned session with recorded sets to history', async () => {
    const base = freshSession()
    const orphan = {
      ...base,
      entries: base.entries.map((e, ei) =>
        ei === 0
          ? {
              ...e,
              sets: e.sets.map((s, si) =>
                si === 0 ? { ...s, values: { weight: 60, reps: 10 } } : s,
              ),
            }
          : e,
      ),
    }
    await sessionsRepo.save(orphan)

    const next = freshSession()
    await useActiveWorkout.getState().start(next)

    const completed = await sessionsRepo.listCompleted()
    expect(completed).toHaveLength(1)
    expect(completed[0].id).toBe(orphan.id)
    expect(completed[0].finishedAt).toBe(orphan.startedAt)
    expect(completed[0].entries[0].sets[0].values).toEqual({
      weight: 60,
      reps: 10,
    })
    const active = await sessionsRepo.listActive()
    expect(active.map((s) => s.id)).toEqual([next.id])
  })

  it('discard removes the session from storage', async () => {
    const store = useActiveWorkout.getState()
    const session = freshSession()
    await store.start(session)

    await useActiveWorkout.getState().discard()

    expect(useActiveWorkout.getState().session).toBeNull()
    expect(await sessionsRepo.get(session.id)).toBeNull()
    expect(await sessionsRepo.listActive()).toHaveLength(0)
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


describe('standalone workout', () => {
  it('autosaves, resumes, prefills, completes and combines progress with template results', async () => {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
    const session = buildSessionFromExercise(bench, 2, 100)
    const store = useActiveWorkout.getState()
    await store.start(session)
    store.setMetric(session.cursor, 'reps', 12)
    await vi.advanceTimersByTimeAsync(500)
    await flushPendingSave()
    useActiveWorkout.setState({ session: null, hydrated: false })
    await store.loadActive()
    expect(useActiveWorkout.getState().session?.entries[0].sets[0].values).toEqual({ reps: 12 })
    store.next()
    expect(useActiveWorkout.getState().session?.entries[0].sets[1].values).toEqual({ reps: 12 })
    await store.complete()
    const regular = freshSession()
    regular.entries[0].sets[0].values = { reps: 8 }
    await sessionsRepo.save({ ...regular, status: 'completed', finishedAt: 10 })
    const history = await sessionsRepo.listCompleted()
    expect(history).toHaveLength(2)
    expect(collectExerciseStats(history)).toHaveLength(1)
    expect(buildSeries(history, bench.id, 'reps').map((point) => point.value)).toEqual([8, 12])
  })

  it.each([false, true])('preserves replacement policy with saved results: %s', async (filled) => {
    const previous = freshSession()
    if (filled) previous.entries[0].sets[0].values = { reps: 8 }
    await sessionsRepo.save(previous)
    const single = buildSessionFromExercise(bench, 2)
    await useActiveWorkout.getState().start(single)
    expect((await sessionsRepo.listActive()).map((s) => s.id)).toEqual([single.id])
    const old = await sessionsRepo.get(previous.id)
    if (filled) expect(old).toMatchObject({ status: 'completed', finishedAt: previous.startedAt })
    else expect(old).toBeNull()
    await useActiveWorkout.getState().discard()
    expect(await sessionsRepo.get(single.id)).toBeNull()
  })
})
