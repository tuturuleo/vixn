import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { Route as HomeRoute } from '@/routes/index'
import { Route as TemplatesRoute } from '@/routes/templates.index'
import { Route as NewTemplateRoute } from '@/routes/templates.new'
import { Route as EditTemplateRoute } from '@/routes/templates.$templateId'
import { Route as StartRoute } from '@/routes/workout.start'
import { Route as ActiveRoute } from '@/routes/workout.active'
import { Route as SummaryRoute } from '@/routes/workout.$sessionId'
import { Route as ProgressRoute } from '@/routes/progress'
import { exercisesRepo, templatesRepo, sessionsRepo } from '@/db/repositories'
import { stores } from '@/db/storage'
import { exportAll, type Backup } from '@/db/backup'
import { buildSessionFromTemplate } from '@/domain/session'
import type { Exercise } from '@/domain/schemas'
import { flushPendingSave, useActiveWorkout } from '@/stores/activeWorkout'

// Drawer gestures/animations are unrelated to the route cache and are not
// implemented by jsdom. Keep the picker interaction without the drawer shell.
vi.mock('@/features/templates/ExercisePickerSheet', () => ({
  ExercisePickerSheet: ({ open, exercises, onPick, onOpenChange }: {
    open: boolean
    exercises: Exercise[]
    onPick: (exercise: Exercise) => void
    onOpenChange: (open: boolean) => void
  }) => open ? exercises.map((exercise) => (
    <button key={exercise.id} onClick={() => { onPick(exercise); onOpenChange(false) }}>
      {exercise.name}
    </button>
  )).concat(<button key="cancel" onClick={() => onOpenChange(false)}>Отмена</button>) : null,
}))

beforeEach(async () => {
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  await flushPendingSave()
  useActiveWorkout.setState({ session: null, hydrated: false })
  await Promise.all(Object.values(stores).map((store) => store.clear()))
})

afterEach(async () => {
  cleanup()
  await flushPendingSave()
  vi.restoreAllMocks()
})

function uploadBackup(backup: Backup | string) {
  const file = new File([], 'backup.json', { type: 'application/json' })
  // jsdom's File does not implement text().
  Object.defineProperty(file, 'text', {
    value: async () => typeof backup === 'string' ? backup : JSON.stringify(backup),
  })
  fireEvent.change(screen.getByLabelText('Файл резервной копии'), {
    target: { files: [file] },
  })
}

async function seed() {
  const exercise = await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
  const template = await templatesRepo.create({
    name: 'Силовая', items: [{ exerciseId: exercise.id, sets: 1 }],
  })
  const session = buildSessionFromTemplate(template, { [exercise.id]: exercise })
  return { exercise, template, session }
}

async function renderPage(path: string) {
  const root = createRootRoute()
  const home = createRoute({ getParentRoute: () => root, path: '/',
    loader: HomeRoute.options.loader, component: HomeRoute.options.component })
  const templates = createRoute({ getParentRoute: () => root, path: '/templates/',
    loader: TemplatesRoute.options.loader, component: TemplatesRoute.options.component })
  const newTemplate = createRoute({ getParentRoute: () => root, path: '/templates/new',
    loader: NewTemplateRoute.options.loader, component: NewTemplateRoute.options.component })
  const editTemplate = createRoute({ getParentRoute: () => root, path: '/templates/$templateId',
    loader: EditTemplateRoute.options.loader, component: EditTemplateRoute.options.component })
  const start = createRoute({ getParentRoute: () => root, path: '/workout/start',
    loader: StartRoute.options.loader, component: StartRoute.options.component })
  const active = createRoute({ getParentRoute: () => root, path: '/workout/active',
    component: ActiveRoute.options.component })
  const summary = createRoute({ getParentRoute: () => root, path: '/workout/$sessionId',
    loader: SummaryRoute.options.loader, component: SummaryRoute.options.component })
  const progress = createRoute({ getParentRoute: () => root, path: '/progress',
    loader: ProgressRoute.options.loader, component: ProgressRoute.options.component })
  const router = createRouter({
    routeTree: root.addChildren([home, templates, newTemplate, editTemplate, start, active, summary, progress]),
    history: createMemoryHistory({ initialEntries: [path] }),
    defaultPreload: 'intent',
    // Keep cached data fresh until invalidated, so automatic stale reloads
    // cannot hide a missing invalidation in these tests.
    defaultStaleTime: Infinity,
    defaultPreloadStaleTime: Infinity,
  })
  await router.load()
  await act(async () => { render(<RouterProvider router={router} />) })
  const preload = async (to: string) => {
    await act(async () => {
      const matches = await router.preloadRoute({ to })
      const match = matches?.at(-1)
      expect(match).toBeDefined()
      expect(router.getMatch(match!.id)?.status).toBe('success')
    })
  }
  const invalidate = vi.spyOn(router, 'invalidate')
  const navigate = async (to: string) => {
    await act(async () => { await router.navigate({ to }) })
  }
  return { router, preload, invalidate, navigate, user: userEvent.setup() }
}

describe('template route invalidation', () => {
  it('creates a template and refreshes the preloaded list and workout picker', async () => {
    await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
    const { preload, user, navigate, invalidate } = await renderPage('/templates/new')
    await preload('/templates')
    await preload('/workout/start')

    await user.type(screen.getByLabelText('Название'), 'Новая силовая')
    await user.click(screen.getByRole('button', { name: 'Добавить упражнение' }))
    fireEvent.click(await screen.findByRole('button', { name: /Жим/ }))
    await user.click(await screen.findByRole('button', { name: 'Сохранить тренировку' }))

    expect(await screen.findByRole('link', { name: /Новая силовая/ })).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await navigate('/workout/start')
    expect(await screen.findByRole('button', { name: /Новая силовая/ })).toBeInTheDocument()
  })

  it('updates a template in the preloaded list and workout picker', async () => {
    const { template } = await seed()
    const { preload, user, navigate, invalidate } = await renderPage(`/templates/${template.id}`)
    await preload('/templates')
    await preload('/workout/start')
    await user.clear(screen.getByLabelText('Название'))
    await user.type(screen.getByLabelText('Название'), 'Обновлённая силовая')
    await user.click(screen.getByRole('button', { name: 'Больше подходов' }))
    await user.click(await screen.findByRole('button', { name: 'Сохранить тренировку' }))

    expect(await screen.findByRole('link', { name: /Обновлённая силовая/ })).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await navigate('/workout/start')
    expect(await screen.findByRole('button', { name: /Обновлённая силовая.*2 подхода/ })).toBeInTheDocument()
  })

  it('removes a template from preloaded pages and cannot reopen the cached editor', async () => {
    const { template } = await seed()
    const { router, preload, user, navigate, invalidate } = await renderPage(`/templates/${template.id}`)
    await preload('/templates')
    await preload('/workout/start')
    await user.click(screen.getByRole('button', { name: 'Удалить тренировку' }))

    expect(await screen.findByText('Пока нет тренировок')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await navigate('/workout/start')
    expect(await screen.findByText('Нет тренировок')).toBeInTheDocument()
    await navigate(`/templates/${template.id}`)
    await waitFor(() => expect(router.state.location.pathname).toBe('/templates'))
    expect(screen.queryByLabelText('Название')).not.toBeInTheDocument()
  })

  it.each(['create', 'update', 'remove'] as const)('does not invalidate or navigate after a rejected %s', async (operation) => {
    const { template } = await seed()
    const { router, preload, user, invalidate } = await renderPage(operation === 'create'
      ? '/templates/new' : `/templates/${template.id}`)
    await preload('/templates')
    vi.spyOn(templatesRepo, operation).mockRejectedValueOnce(new Error('Storage unavailable'))
    if (operation === 'create') {
      await user.type(screen.getByLabelText('Название'), 'Новая силовая')
      await user.click(screen.getByRole('button', { name: 'Добавить упражнение' }))
      fireEvent.click(await screen.findByRole('button', { name: /Жим/ }))
    }
    const path = router.state.location.pathname
    await user.click(await screen.findByRole('button', { name: operation === 'remove'
      ? 'Удалить тренировку' : 'Сохранить тренировку' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось')
    expect(invalidate).not.toHaveBeenCalled()
    expect(router.state.location.pathname).toBe(path)
    expect(await templatesRepo.get(template.id)).toEqual(template)
  })
})

describe('session route invalidation', () => {
  it('starts a session and refreshes preloaded resume links', async () => {
    await seed()
    const { preload, user, navigate, invalidate } = await renderPage('/workout/start')
    await preload('/')
    await user.click(screen.getByRole('button', { name: /Силовая/ }))
    expect(await screen.findByRole('button', { name: 'Завершить' })).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await navigate('/')
    expect(await screen.findByText('Продолжить тренировку')).toBeInTheDocument()
    await navigate('/workout/start')
    expect(await screen.findByText('Продолжить тренировку')).toBeInTheDocument()
  })

  it('completes a session, refreshes preloaded history and clears resume links', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().start(session)
    const { preload, user, navigate, invalidate } = await renderPage('/workout/active')
    await preload('/')
    await preload('/workout/start')
    await preload('/progress')
    await preload(`/workout/${session.id}`)
    await user.type(screen.getByRole('textbox'), '12')
    await act(async () => { await flushPendingSave() })
    expect(invalidate).not.toHaveBeenCalled()
    await user.click(screen.getByRole('button', { name: 'Завершить' }))

    expect(await screen.findByRole('heading', { name: 'Силовая' })).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await navigate('/progress')
    await user.click(screen.getByRole('button', { name: 'История' }))
    expect(await screen.findByRole('link', { name: /Силовая/ })).toBeInTheDocument()
    await navigate('/')
    await waitFor(() => expect(screen.queryByText('Продолжить тренировку')).not.toBeInTheDocument())
    await navigate('/workout/start')
    await waitFor(() => expect(screen.queryByText('Продолжить тренировку')).not.toBeInTheDocument())
  })

  it('removes a session from preloaded history and cannot reopen its cached summary', async () => {
    const { session } = await seed()
    await sessionsRepo.save({ ...session, status: 'completed', finishedAt: session.startedAt + 1000 })
    const { router, preload, user, navigate, invalidate } = await renderPage(`/workout/${session.id}`)
    await preload('/progress')
    await user.click(screen.getByRole('button', { name: 'Удалить запись' }))
    expect(await screen.findByText('Пока нет данных')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await navigate(`/workout/${session.id}`)
    await waitFor(() => expect(router.state.location.pathname).toBe('/progress'))
    expect(screen.queryByRole('button', { name: 'Удалить запись' })).not.toBeInTheDocument()
  })

  it.each([false, true])('discards a session (empty: %s) and clears preloaded resume links', async (empty) => {
    const { session } = await seed()
    await useActiveWorkout.getState().start({ ...session, entries: empty ? [] : session.entries })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    const { router, preload, user, navigate, invalidate } = await renderPage('/workout/active')
    await preload('/')
    await preload('/workout/start')
    await user.click(screen.getByRole('button', { name: empty ? 'Отменить тренировку' : 'Отменить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(invalidate).toHaveBeenCalledTimes(1)
    await waitFor(() => expect(screen.queryByText('Продолжить тренировку')).not.toBeInTheDocument())
    await navigate('/workout/start')
    await waitFor(() => expect(screen.queryByText('Продолжить тренировку')).not.toBeInTheDocument())
    expect(await sessionsRepo.get(session.id)).toBeNull()
  })
})

describe('backup import and active workout', () => {
  it('opens an imported active session after the store was hydrated without one', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().loadActive()
    expect(useActiveWorkout.getState()).toMatchObject({ hydrated: true, session: null })
    const backup = { ...await exportAll(), sessions: [session] }
    const { user } = await renderPage('/')

    uploadBackup(backup)
    expect(await screen.findByText('Импортировано: 1, обновлено: 0')).toBeInTheDocument()
    await user.click(await screen.findByRole('link', { name: /Продолжить тренировку/ }))

    expect(await screen.findByRole('button', { name: 'Завершить' })).toBeInTheDocument()
    expect(useActiveWorkout.getState().session).toEqual(session)
  })

  it('stops offering the stale active version when its completed version is imported', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().start(session)
    const completed = { ...session, status: 'completed' as const, finishedAt: session.startedAt + 1000 }
    const { router, navigate } = await renderPage('/')

    uploadBackup({ ...await exportAll(), sessions: [completed] })
    expect(await screen.findByText('Импортировано: 0, обновлено: 1')).toBeInTheDocument()
    expect(useActiveWorkout.getState()).toMatchObject({ hydrated: true, session: null })
    expect(screen.queryByText('Продолжить тренировку')).not.toBeInTheDocument()
    await navigate('/workout/active')
    await waitFor(() => expect(router.state.location.pathname).toBe('/workout/start'))
    expect(await sessionsRepo.get(session.id)).toEqual(completed)
  })

  it('drains pending autosave before merging so it cannot overwrite the imported session', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().start(session)
    const completed = { ...session, status: 'completed' as const, finishedAt: session.startedAt + 1000 }
    const backup = { ...await exportAll(), sessions: [completed] }
    await renderPage('/')
    useActiveWorkout.getState().setMetric(session.cursor, 'reps', 12)

    uploadBackup(backup)
    expect(await screen.findByText('Импортировано: 0, обновлено: 1')).toBeInTheDocument()
    await act(async () => { await flushPendingSave() })

    expect(await sessionsRepo.get(session.id)).toEqual(completed)
    expect(await sessionsRepo.getActive()).toBeNull()
    expect(useActiveWorkout.getState().session).toBeNull()
  })

  it('shows an import error and preserves the current workout and its edits', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().start(session)
    const { invalidate } = await renderPage('/')
    useActiveWorkout.getState().setMetric(session.cursor, 'reps', 12)
    const current = useActiveWorkout.getState().session

    uploadBackup('not json')

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Не удалось прочитать JSON'))
    expect(invalidate).not.toHaveBeenCalled()
    expect(useActiveWorkout.getState()).toMatchObject({ hydrated: true, session: current })
    await flushPendingSave()
    expect(await sessionsRepo.get(session.id)).toEqual(current)
  })

  it('shows a storage error during import without clearing the current workout', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().start(session)
    const backup = {
      ...await exportAll(),
      sessions: [{ ...session, status: 'completed' as const, finishedAt: session.startedAt + 1000 }],
    }
    const { invalidate } = await renderPage('/')
    vi.spyOn(stores.sessions, 'setItem').mockRejectedValueOnce(new Error('Ошибка записи'))

    uploadBackup(backup)

    await waitFor(() => expect(screen.getByRole('status')).toHaveTextContent('Ошибка записи'))
    expect(invalidate).not.toHaveBeenCalled()
    expect(useActiveWorkout.getState()).toMatchObject({ hydrated: true, session })
    expect(await sessionsRepo.get(session.id)).toEqual(session)
  })
})


describe('standalone exercise start', () => {
  async function choose(user: ReturnType<typeof userEvent.setup>) {
    await user.click(screen.getByRole('button', { name: 'Выполнить упражнение' }))
    await user.click(screen.getByRole('button', { name: 'Жим' }))
  }

  it('starts without templates, excludes archived exercises, resumes after reload and finishes in history', async () => {
    const exercise = await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
    const archived = await exercisesRepo.create({ name: 'Архивное', metrics: ['weight'] })
    await exercisesRepo.archive(archived.id)
    const { preload, user, navigate, invalidate } = await renderPage('/workout/start')
    await preload('/')
    await user.click(screen.getByRole('button', { name: 'Выполнить упражнение' }))
    expect(screen.queryByRole('button', { name: 'Архивное' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Жим' }))
    expect(screen.getByText('3 подхода')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Меньше подходов' }))
    await user.click(screen.getByRole('button', { name: 'Начать упражнение' }))
    expect(await screen.findByText('Подход 1 из 2 · 2 подхода')).toBeInTheDocument()
    const session = useActiveWorkout.getState().session!
    expect(session.templateId).toBeNull()
    expect(session.entries).toHaveLength(1)
    expect(session.entries[0].exerciseId).toBe(exercise.id)
    expect(invalidate).toHaveBeenCalledTimes(1)
    await user.type(screen.getByRole('textbox'), '12')
    await waitFor(async () => expect((await sessionsRepo.get(session.id))?.entries[0].sets[0].values).toEqual({ reps: 12 }))
    await navigate('/')
    expect(await screen.findByRole('link', { name: /Продолжить тренировку.*Упражнение: Жим/ })).toBeInTheDocument()
    await navigate('/workout/start')
    expect(await screen.findByRole('link', { name: /Продолжить тренировку.*Упражнение: Жим/ })).toBeInTheDocument()
    cleanup()
    useActiveWorkout.setState({ session: null, hydrated: false })
    const reloaded = await renderPage('/workout/active')
    expect(await screen.findByRole('textbox')).toHaveValue('12')
    await reloaded.user.click(screen.getByRole('button', { name: 'Далее' }))
    expect(screen.getByRole('textbox')).toHaveValue('12')
    await reloaded.user.click(screen.getByRole('button', { name: 'Завершить' }))
    expect(await screen.findByRole('heading', { name: 'Упражнение: Жим' })).toBeInTheDocument()
    expect(screen.getByText('Жим')).toBeInTheDocument()
    await reloaded.navigate('/progress')
    expect(await screen.findByRole('button', { name: 'Жим' })).toBeInTheDocument()
    await reloaded.user.click(screen.getByRole('button', { name: 'История' }))
    expect(await screen.findByRole('link', { name: /Упражнение: Жим/ })).toBeInTheDocument()
    expect(await sessionsRepo.listCompleted()).toHaveLength(1)
    expect(await templatesRepo.list()).toEqual([])
  })

  it('cancels picker and configuration without replacing the current session; enforces bounds', async () => {
    const { session } = await seed()
    await useActiveWorkout.getState().start(session)
    const { user } = await renderPage('/workout/start')
    await user.click(screen.getByRole('button', { name: 'Выполнить упражнение' }))
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(screen.queryByRole('button', { name: 'Начать упражнение' })).not.toBeInTheDocument()
    await choose(user)
    for (let i = 0; i < 3; i++) await user.click(screen.getByRole('button', { name: 'Меньше подходов' }))
    expect(screen.getByRole('button', { name: 'Меньше подходов' })).toBeDisabled()
    for (let i = 0; i < 20; i++) await user.click(screen.getByRole('button', { name: 'Больше подходов' }))
    expect(screen.getByText('20 подходов')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Больше подходов' })).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Отмена' }))
    expect(await sessionsRepo.getActive()).toEqual(session)
    expect(useActiveWorkout.getState().session).toEqual(session)
  })

  it('shows an empty state linked to the exercise library when all exercises are archived', async () => {
    const exercise = await exercisesRepo.create({ name: 'Архивное', metrics: ['reps'] })
    await exercisesRepo.archive(exercise.id)
    const { user } = await renderPage('/workout/start')
    await user.click(screen.getByRole('button', { name: 'Выполнить упражнение' }))
    expect(screen.getByText(/Нет активных упражнений/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Добавьте упражнение в справочник' })).toHaveAttribute('href', '/exercises')
    expect(await sessionsRepo.getActive()).toBeNull()
  })

  it('waits for persistence, blocks duplicate starts and stays on the page on failure', async () => {
    await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
    const { user, router, invalidate } = await renderPage('/workout/start')
    await choose(user)
    let reject!: (error: Error) => void
    const save = vi.spyOn(sessionsRepo, 'save').mockImplementationOnce(() => new Promise((_, fail) => { reject = fail }))
    fireEvent.click(screen.getByRole('button', { name: 'Начать упражнение' }))
    fireEvent.click(screen.getByRole('button', { name: 'Запуск…' }))
    await waitFor(() => expect(save).toHaveBeenCalledTimes(1))
    expect(router.state.location.pathname).toBe('/workout/start')
    expect(invalidate).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Запуск…' })).toBeDisabled()
    await act(async () => reject(new Error('Storage unavailable')))
    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось начать выполнение')
    expect(router.state.location.pathname).toBe('/workout/start')
    expect(invalidate).not.toHaveBeenCalled()
    expect(await sessionsRepo.getActive()).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Начать упражнение' }))
    expect(await screen.findByText('Подход 1 из 3 · 3 подхода')).toBeInTheDocument()
  })

  it('discards a standalone session through the existing active screen', async () => {
    await exercisesRepo.create({ name: 'Жим', metrics: ['reps'] })
    const { user, router } = await renderPage('/workout/start')
    await choose(user)
    await user.click(screen.getByRole('button', { name: 'Начать упражнение' }))
    await screen.findByRole('button', { name: 'Отменить' })
    vi.spyOn(window, 'confirm').mockReturnValue(true)
    await user.click(screen.getByRole('button', { name: 'Отменить' }))
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(await sessionsRepo.getActive()).toBeNull()
    expect(await sessionsRepo.listCompleted()).toEqual([])
    expect(await templatesRepo.list()).toEqual([])
  })
})
