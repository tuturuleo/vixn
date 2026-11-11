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
  )) : null,
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
