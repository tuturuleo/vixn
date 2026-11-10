import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ExerciseFormSheet } from './ExerciseFormSheet'
import type { Exercise } from '@/domain/schemas'

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const exercise: Exercise = {
  id: 'press', name: 'Жим', metrics: ['weight', 'reps'],
  archived: false, createdAt: 0, updatedAt: 0,
}

afterEach(cleanup)

describe('ExerciseFormSheet', () => {
  it.each(['save', 'archive'] as const)('%s: keeps the draft after failure and allows retry', async (operation) => {
    const first = deferred()
    const retry = deferred()
    const callback = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
    const other = vi.fn()
    const onOpenChange = vi.fn()
    render(<ExerciseFormSheet open exercise={exercise} onOpenChange={onOpenChange}
      onSubmit={operation === 'save' ? callback : other}
      onArchive={operation === 'archive' ? callback : other} />)

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Новый жим' } })
    fireEvent.click(screen.getByRole('button', { name: /Вес/ }))
    const save = screen.getByRole('button', { name: 'Сохранить' })
    const archive = screen.getByRole('button', { name: 'Архивировать' })
    const action = operation === 'save' ? save : archive

    fireEvent.click(action)
    expect(save).toBeDisabled()
    expect(archive).toBeDisabled()
    fireEvent.click(save)
    fireEvent.click(archive)
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(callback).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
    expect(onOpenChange).not.toHaveBeenCalled()

    await act(async () => first.reject(new Error('storage failed')))
    expect(screen.getByRole('alert')).toHaveTextContent(operation === 'save'
      ? 'Не удалось сохранить упражнение. Попробуйте ещё раз.'
      : 'Не удалось архивировать упражнение. Попробуйте ещё раз.')
    expect(screen.getByLabelText('Название')).toHaveValue('Новый жим')
    expect(screen.getByRole('button', { name: /Вес/ })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: 'Повторы' })).toHaveAttribute('aria-pressed', 'true')
    expect(onOpenChange).not.toHaveBeenCalled()
    expect(save).toBeEnabled()
    expect(archive).toBeEnabled()

    fireEvent.click(action)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(callback).toHaveBeenCalledTimes(2)
    if (operation === 'save') {
      expect(callback).toHaveBeenLastCalledWith({ name: 'Новый жим', metrics: ['reps'] })
    } else {
      expect(callback).toHaveBeenLastCalledWith(exercise.id)
    }
    expect(onOpenChange).not.toHaveBeenCalled()
    await act(async () => retry.resolve())
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
  })

  it('clears an old error on reopening and preserves synchronous creation', async () => {
    const onSubmit = vi.fn().mockRejectedValueOnce(new Error('storage failed')).mockReturnValueOnce(undefined)
    const props = { exercise: null, onSubmit, onArchive: vi.fn(), onOpenChange: vi.fn() }
    const { rerender } = render(<ExerciseFormSheet {...props} open />)
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Присед' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    expect(await screen.findByRole('alert')).toBeInTheDocument()
    rerender(<ExerciseFormSheet {...props} open={false} />)
    rerender(<ExerciseFormSheet {...props} open />)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Название')).toHaveValue('')
    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Присед' } })
    fireEvent.click(screen.getByRole('button', { name: 'Добавить' }))
    await act(async () => {})
    expect(props.onOpenChange).toHaveBeenCalledExactlyOnceWith(false)
  })
})
