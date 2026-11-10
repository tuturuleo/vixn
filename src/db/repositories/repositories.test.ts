import { describe, it, expect, beforeEach } from 'vitest'
import { exercisesRepo } from './exercises'
import { templatesRepo } from './templates'
import { sessionsRepo } from './sessions'
import { stores } from '../storage'
import { buildSessionFromTemplate } from '@/domain/session'

beforeEach(async () => {
  await Promise.all([
    stores.exercises.clear(),
    stores.templates.clear(),
    stores.sessions.clear(),
  ])
})

describe('exercisesRepo', () => {
  it('creates, trims name and lists alphabetically', async () => {
    await exercisesRepo.create({ name: 'Приседания', metrics: ['weight', 'reps'] })
    await exercisesRepo.create({ name: '  Выпады  ', metrics: ['reps'] })

    const list = await exercisesRepo.list()
    expect(list.map((e) => e.name)).toEqual(['Выпады', 'Приседания'])
  })

  it('archive hides from list() but keeps in listAll()', async () => {
    const ex = await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
    await exercisesRepo.archive(ex.id)

    expect(await exercisesRepo.list()).toHaveLength(0)
    expect(await exercisesRepo.listAll()).toHaveLength(1)
    expect((await exercisesRepo.get(ex.id))?.archived).toBe(true)
  })

  it('update patches fields and bumps updatedAt', async () => {
    const ex = await exercisesRepo.create({ name: 'Тяга', metrics: ['reps'] })
    const updated = await exercisesRepo.update(ex.id, {
      metrics: ['weight', 'reps'],
    })
    expect(updated.metrics).toEqual(['weight', 'reps'])
    expect(updated.updatedAt).toBeGreaterThanOrEqual(ex.updatedAt)
  })

  it('restore preserves the id, template and session and returns the exercise to list()', async () => {
    const ex = await exercisesRepo.create({ name: 'Жим', metrics: ['weight', 'reps'] })
    const template = await templatesRepo.create({
      name: 'Грудь',
      items: [{ exerciseId: ex.id, sets: 2 }],
    })
    const session = await sessionsRepo.save(buildSessionFromTemplate(template, { [ex.id]: ex }))
    await exercisesRepo.archive(ex.id)
    expect(await exercisesRepo.list()).toEqual([])

    const restored = await exercisesRepo.restore(ex.id)

    expect(restored).toEqual({ ...ex, archived: false, updatedAt: restored.updatedAt })
    expect(restored.updatedAt).toBeGreaterThanOrEqual(ex.updatedAt)
    expect(await exercisesRepo.get(ex.id)).toEqual(restored)
    expect(await exercisesRepo.list()).toEqual([restored])
    expect(await exercisesRepo.listAll()).toEqual([restored])
    expect(await templatesRepo.get(template.id)).toEqual(template)
    expect(await sessionsRepo.get(session.id)).toEqual(session)
    const newTemplate = await templatesRepo.create({
      name: 'Новая тренировка',
      items: [{ exerciseId: (await exercisesRepo.list())[0].id, sets: 1 }],
    })
    expect(newTemplate.items[0].exerciseId).toBe(ex.id)
  })
})

describe('templatesRepo', () => {
  it('assigns order from array position', async () => {
    const t = await templatesRepo.create({
      name: 'Ноги',
      items: [
        { exerciseId: 'a', sets: 3 },
        { exerciseId: 'b', sets: 4 },
      ],
    })
    expect(t.items).toEqual([
      { exerciseId: 'a', sets: 3, order: 0 },
      { exerciseId: 'b', sets: 4, order: 1 },
    ])
  })
})

describe('sessionsRepo', () => {
  it('tracks the active session and moves it to history on completion', async () => {
    const ex = await exercisesRepo.create({
      name: 'Жим',
      metrics: ['weight', 'reps'],
    })
    const template = await templatesRepo.create({
      name: 'Грудь',
      items: [{ exerciseId: ex.id, sets: 2 }],
    })

    const session = buildSessionFromTemplate(template, { [ex.id]: ex })
    await sessionsRepo.save(session)

    expect((await sessionsRepo.getActive())?.id).toBe(session.id)
    expect(await sessionsRepo.listCompleted()).toHaveLength(0)

    await sessionsRepo.save({
      ...session,
      status: 'completed',
      finishedAt: Date.now(),
    })

    expect(await sessionsRepo.getActive()).toBeNull()
    const history = await sessionsRepo.listCompleted()
    expect(history).toHaveLength(1)
    expect(history[0].id).toBe(session.id)
  })

  it('listActive returns all in-progress sessions, newest first', async () => {
    const ex = await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
    const template = await templatesRepo.create({
      name: 'Грудь',
      items: [{ exerciseId: ex.id, sets: 1 }],
    })
    const build = (startedAt: number) =>
      buildSessionFromTemplate(template, { [ex.id]: ex }, startedAt)

    const older = build(1000)
    const newer = build(2000)
    const done = build(3000)
    await sessionsRepo.save(older)
    await sessionsRepo.save(newer)
    await sessionsRepo.save({ ...done, status: 'completed', finishedAt: 4000 })

    const active = await sessionsRepo.listActive()
    expect(active.map((s) => s.id)).toEqual([newer.id, older.id])
  })
})

describe('createCollection resilience', () => {
  it('skips corrupt rows instead of throwing', async () => {
    await exercisesRepo.create({ name: 'Ок', metrics: ['reps'] })
    // Write a malformed record straight to the store.
    await stores.exercises.setItem('broken', { id: 'broken', nope: true })

    const list = await exercisesRepo.list()
    expect(list).toHaveLength(1)
    expect(list[0].name).toBe('Ок')
    expect(await exercisesRepo.get('broken')).toBeNull()
  })
})
