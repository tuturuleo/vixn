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
