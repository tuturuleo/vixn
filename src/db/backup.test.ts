import { beforeEach, describe, expect, it } from 'vitest'
import { exportAll, importAll, parseBackup, serializeBackup, type Backup } from './backup'
import { buildSessionFromExercise } from '@/domain/session'
import { sessionsRepo } from './repositories'
import { SCHEMA_VERSION, stores } from './storage'

const clearStores = () => Promise.all(Object.values(stores).map((store) => store.clear()))

beforeEach(async () => {
  await clearStores()
})

function fixture(): Backup {
  return {
    app: 'vixn',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: 1000,
    exercises: [{
      id: 'exercise', name: 'Жим', metrics: ['weight', 'reps'],
      archived: true, createdAt: 100, updatedAt: 200,
    }],
    templates: [{
      id: 'template', name: 'Грудь', createdAt: 100, updatedAt: 200,
      items: [{ exerciseId: 'exercise', sets: 1, order: 0 }],
    }],
    sessions: [
      {
        id: 'completed', templateId: 'template', templateName: 'Грудь',
        status: 'completed', startedAt: 100, finishedAt: 200,
        entries: [{
          exerciseId: 'exercise', exerciseName: 'Жим', metrics: ['weight', 'reps'],
          order: 0, sets: [{ setIndex: 0, values: { weight: 50, reps: 10 } }],
        }],
        cursor: { entryIndex: 0, setIndex: 0 },
      },
      {
        id: 'active', templateId: 'template', templateName: 'Грудь',
        status: 'in_progress', startedAt: 300, finishedAt: null,
        entries: [], cursor: { entryIndex: 0, setIndex: 0 },
      },
    ],
  }
}

describe('backup', () => {
  it('round-trips every entity, including archived exercises and unfinished sessions', async () => {
    const original = fixture()
    await stores.exercises.setItem('exercise', original.exercises[0])
    await stores.templates.setItem('template', original.templates[0])
    for (const session of original.sessions) await stores.sessions.setItem(session.id, session)

    const backup = await exportAll()
    expect(backup.app).toBe('vixn')
    expect(backup.schemaVersion).toBe(SCHEMA_VERSION)
    expect(backup.exportedAt).toBeGreaterThan(0)
    expect(serializeBackup(backup)).toBe(JSON.stringify(backup, null, 2))
    await clearStores()
    expect(await importAll(parseBackup(serializeBackup(backup))))
      .toEqual({ added: 4, updated: 0, skipped: 0 })
    const restored = await exportAll()
    expect(restored.exercises).toEqual(original.exercises)
    expect(restored.templates).toEqual(original.templates)
    expect(restored.sessions).toEqual(backup.sessions)
    expect(await importAll(backup)).toEqual({ added: 0, updated: 0, skipped: 4 })
  })

  it('keeps newer local records and updates them only from newer incoming records', async () => {
    const original = fixture()
    await importAll(original)
    const older = fixture()
    older.exercises[0].updatedAt = 150
    older.exercises[0].name = 'Старое имя'
    older.templates[0].updatedAt = 150
    older.sessions[0].finishedAt = 150
    older.sessions[1].startedAt = 150
    expect(await importAll(older)).toEqual({ added: 0, updated: 0, skipped: 4 })
    expect((await exportAll()).exercises).toEqual(original.exercises)

    const newer = fixture()
    newer.exercises[0].updatedAt = 400
    newer.exercises[0].name = 'Новое имя'
    newer.templates[0].updatedAt = 400
    newer.sessions[0].finishedAt = 400
    newer.sessions[1].startedAt = 400
    expect(await importAll(newer)).toEqual({ added: 0, updated: 4, skipped: 0 })
    expect(await stores.exercises.getItem('exercise')).toEqual(newer.exercises[0])
    expect(await stores.templates.getItem('template')).toEqual(newer.templates[0])
    for (const session of newer.sessions) {
      expect(await stores.sessions.getItem(session.id)).toEqual(session)
    }
  })

  it('always prefers completed sessions over in-progress versions', async () => {
    await importAll(fixture())
    const incoming = fixture()
    incoming.sessions[0].status = 'in_progress'
    incoming.sessions[0].finishedAt = null
    incoming.sessions[0].startedAt = 1000
    incoming.sessions[1].status = 'completed'
    incoming.sessions[1].startedAt = 50
    incoming.sessions[1].finishedAt = 100
    expect(await importAll(incoming)).toEqual({ added: 0, updated: 1, skipped: 3 })
    expect(await stores.sessions.getItem('completed')).toEqual(fixture().sessions[0])
    expect(await stores.sessions.getItem('active')).toEqual(incoming.sessions[1])
  })

  it.each(['{}', 'not json', JSON.stringify({ ...fixture(), app: 'other' })])(
    'rejects invalid JSON or format without changing data: %s',
    async (text) => {
      await importAll(fixture())
      const before = await exportAll()
      expect(() => parseBackup(text)).toThrow(/[А-Яа-яЁё]/)
      expect(await exportAll()).toEqual({ ...before, exportedAt: expect.any(Number) })
    },
  )

  it('rejects future schema versions before writing', async () => {
    const future = { ...fixture(), schemaVersion: SCHEMA_VERSION + 1 }
    expect(() => parseBackup(JSON.stringify(future))).toThrow('более новой версии')
    await expect(importAll(future)).rejects.toThrow('более новой версии')
    expect(await stores.exercises.length()).toBe(0)
  })

  it('validates the entire file before any writes, even when called directly', async () => {
    await importAll(fixture())
    await stores.meta.setItem('sentinel', 'unchanged')
    const before = await exportAll()
    const invalid = fixture()
    invalid.exercises.push({ ...invalid.exercises[0], id: 'new-exercise' })
    invalid.templates[0].name = 'Changed'
    invalid.templates[0].updatedAt = 500
    invalid.sessions[1].entries = [{
      exerciseId: '', exerciseName: 'Broken', metrics: ['reps'], order: 0, sets: [],
    }]

    expect(() => parseBackup(JSON.stringify(invalid))).toThrow('повреждённые записи')
    await expect(importAll(invalid)).rejects.toThrow('повреждённые записи')
    expect(await exportAll()).toEqual({ ...before, exportedAt: expect.any(Number) })
    expect(await stores.meta.getItem('sentinel')).toBe('unchanged')
  })

  it('skips corrupt stored rows during export', async () => {
    await importAll(fixture())
    await stores.exercises.setItem('broken', { id: 'broken' })
    expect((await exportAll()).exercises).toEqual(fixture().exercises)
  })
})


it('round-trips standalone and legacy sessions through repository and backup', async () => {
  const legacy = fixture()
  await importAll(parseBackup(JSON.stringify(legacy)))
  const single = buildSessionFromExercise(legacy.exercises[0], 2, 500)
  single.entries[0].sets[0].values = { weight: 60, reps: 12 }
  await sessionsRepo.save(single)
  expect(await sessionsRepo.get(single.id)).toEqual(single)
  const backup = parseBackup(serializeBackup(await exportAll()))
  expect(backup.sessions).toContainEqual(single)
  await clearStores()
  await importAll(backup)
  expect(await sessionsRepo.get(single.id)).toEqual(single)
  for (const session of legacy.sessions) expect(await sessionsRepo.get(session.id)).toEqual(session)
})
