import { act, cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
  RouterProvider,
} from '@tanstack/react-router'
import { Route } from '@/routes/exercises'
import { exercisesRepo } from '@/db/repositories'
import { stores } from '@/db/storage'

beforeEach(async () => {
  // jsdom does not implement the router's scroll restoration target.
  vi.spyOn(window, 'scrollTo').mockImplementation(() => {})
  await stores.exercises.clear()
})

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

async function renderPage() {
  const root = createRootRoute()
  const exercises = createRoute({
    getParentRoute: () => root,
    path: '/exercises',
    loader: Route.options.loader,
    component: Route.options.component,
  })
  const router = createRouter({
    routeTree: root.addChildren([exercises]),
    history: createMemoryHistory({ initialEntries: ['/exercises'] }),
  })
  await router.load()
  render(<RouterProvider router={router} />)
  await screen.findByRole('heading', { name: 'Упражнения' })
  return { router, user: userEvent.setup() }
}

async function createArchived() {
  const exercise = await exercisesRepo.create({ name: 'Жим', metrics: ['weight', 'reps'] })
  await exercisesRepo.archive(exercise.id)
  return exercise
}

describe('exercise directory archive', () => {
  it('shows active exercises by default and switches lists without editing archived rows', async () => {
    await exercisesRepo.create({ name: 'Приседания', metrics: ['reps'] })
    await createArchived()
    const { user } = await renderPage()

    expect(screen.getByRole('button', { name: 'Активные' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Приседания')).toBeInTheDocument()
    expect(screen.queryByText('Жим')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Архив' }))
    expect(screen.getByRole('button', { name: 'Архив' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.queryByText('Приседания')).not.toBeInTheDocument()
    await user.click(screen.getByText('Жим'))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Восстановить' })).toBeEnabled()

    await user.click(screen.getByRole('button', { name: 'Активные' }))
    await user.click(screen.getByRole('button', { name: /Приседания/ }))
    expect(await screen.findByRole('dialog')).toBeInTheDocument()
  })

  it('shows an empty archive', async () => {
    const { user } = await renderPage()
    expect(screen.getByText('Пока нет упражнений')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Архив' }))
    expect(screen.getByText('Архив пуст')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Восстановить' })).not.toBeInTheDocument()
  })

  it('restores once while pending, invalidates the loader and shows the same exercise among active ones', async () => {
    const exercise = await createArchived()
    const restore = exercisesRepo.restore.bind(exercisesRepo)
    let finish!: () => void
    const pending = new Promise<void>((resolve) => { finish = resolve })
    const restoreSpy = vi.spyOn(exercisesRepo, 'restore').mockImplementation(async (id) => {
      await pending
      return restore(id)
    })
    const { router, user } = await renderPage()
    const invalidate = vi.spyOn(router, 'invalidate')
    await user.click(screen.getByRole('button', { name: 'Архив' }))
    await user.click(screen.getByRole('button', { name: 'Восстановить' }))
    const button = screen.getByRole('button', { name: 'Восстановление…' })
    expect(button).toBeDisabled()
    await user.click(button)
    expect(restoreSpy).toHaveBeenCalledExactlyOnceWith(exercise.id)
    expect(invalidate).not.toHaveBeenCalled()

    await act(async () => { finish() })
    expect(await screen.findByText('Архив пуст')).toBeInTheDocument()
    expect(invalidate).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Активные' }))
    expect(screen.getByRole('button', { name: /Жим/ })).toBeInTheDocument()
    expect((await exercisesRepo.list()).map((item) => item.id)).toEqual([exercise.id])
  })

  it('shows a Russian error and allows retrying a failed restore', async () => {
    const exercise = await createArchived()
    const restoreSpy = vi.spyOn(exercisesRepo, 'restore')
      .mockRejectedValueOnce(new Error('Storage unavailable'))
    const { router, user } = await renderPage()
    const invalidate = vi.spyOn(router, 'invalidate')
    await user.click(screen.getByRole('button', { name: 'Архив' }))
    await user.click(screen.getByRole('button', { name: 'Восстановить' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('Не удалось восстановить упражнение')
    expect(screen.getByRole('button', { name: 'Восстановить' })).toBeEnabled()
    expect(invalidate).not.toHaveBeenCalled()
    expect(await exercisesRepo.list()).toEqual([])

    await user.click(screen.getByRole('button', { name: 'Восстановить' }))
    await waitFor(() => expect(screen.getByText('Архив пуст')).toBeInTheDocument())
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(restoreSpy).toHaveBeenCalledTimes(2)
    expect(restoreSpy).toHaveBeenLastCalledWith(exercise.id)
    expect(invalidate).toHaveBeenCalledTimes(1)
  })
})
