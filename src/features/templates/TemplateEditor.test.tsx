import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { TemplateEditor } from './TemplateEditor'

const { navigate } = vi.hoisted(() => ({ navigate: vi.fn() }))
vi.mock('@tanstack/react-router', () => ({ useNavigate: () => navigate }))

function deferred() {
  let resolve!: () => void
  let reject!: (error: Error) => void
  const promise = new Promise<void>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})

describe('TemplateEditor', () => {
  it.each(['save', 'delete'] as const)('%s: keeps the draft after failure and allows retry', async (operation) => {
    const first = deferred()
    const retry = deferred()
    const callback = vi.fn().mockReturnValueOnce(first.promise).mockReturnValueOnce(retry.promise)
    const other = vi.fn().mockResolvedValue(undefined)
    render(<TemplateEditor title="Тренировка" exercises={[]} initialName="Исходное название"
      initialItems={[
        { exerciseId: 'press', name: 'Жим', sets: 3 },
        { exerciseId: 'squat', name: 'Присед', sets: 2 },
      ]}
      onSave={operation === 'save' ? callback : other}
      onDelete={operation === 'delete' ? callback : other} />)

    fireEvent.change(screen.getByLabelText('Название'), { target: { value: 'Новая тренировка' } })
    fireEvent.click(screen.getAllByRole('button', { name: 'Больше подходов' })[0])
    const save = screen.getByRole('button', { name: 'Сохранить тренировку' })
    const remove = screen.getByRole('button', { name: 'Удалить тренировку' })
    const back = screen.getByRole('button', { name: 'Назад' })
    const action = operation === 'save' ? save : remove

    fireEvent.click(action)
    expect(save).toBeDisabled()
    expect(remove).toBeDisabled()
    expect(back).toBeDisabled()
    fireEvent.click(save)
    fireEvent.click(remove)
    fireEvent.click(back)
    expect(callback).toHaveBeenCalledTimes(1)
    expect(other).not.toHaveBeenCalled()
    expect(navigate).not.toHaveBeenCalled()

    await act(async () => first.reject(new Error('storage failed')))
    expect(screen.getByRole('alert')).toHaveTextContent(operation === 'save'
      ? 'Не удалось сохранить тренировку. Попробуйте ещё раз.'
      : 'Не удалось удалить тренировку. Попробуйте ещё раз.')
    expect(screen.getByLabelText('Название')).toHaveValue('Новая тренировка')
    expect(screen.getByText('Жим')).toBeInTheDocument()
    expect(screen.getByText('Присед')).toBeInTheDocument()
    expect(screen.getByText('4 подхода')).toBeInTheDocument()
    expect(screen.getByText('2 подхода')).toBeInTheDocument()
    expect(navigate).not.toHaveBeenCalled()
    expect(save).toBeEnabled()
    expect(remove).toBeEnabled()
    expect(back).toBeEnabled()

    fireEvent.click(action)
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(callback).toHaveBeenCalledTimes(2)
    if (operation === 'save') {
      expect(callback).toHaveBeenLastCalledWith({ name: 'Новая тренировка', items: [
        { exerciseId: 'press', sets: 4 }, { exerciseId: 'squat', sets: 2 },
      ] })
    }
    expect(navigate).not.toHaveBeenCalled()
    await act(async () => retry.resolve())
    expect(navigate).toHaveBeenCalledExactlyOnceWith({ to: '/templates' })
  })
})
