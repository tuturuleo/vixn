import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react'
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
  it('moves whole rows one position in either direction and saves their order and sets', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TemplateEditor title="Тренировка" exercises={[]} initialName="Программа"
      initialItems={[
        { exerciseId: 'press', name: 'Жим', sets: 3 },
        { exerciseId: 'squat', name: 'Присед', sets: 2 },
        { exerciseId: 'pull', name: 'Тяга', sets: 5 },
      ]} onSave={onSave} />)

    const rows = () => screen.getAllByRole('listitem').map((row) =>
      row.querySelector('p')?.textContent)
    const up = () => screen.getAllByRole('button', { name: /^Переместить вверх:/ })
    const down = () => screen.getAllByRole('button', { name: /^Переместить вниз:/ })

    expect(up()[0]).toBeDisabled()
    expect(down()[2]).toBeDisabled()
    expect(up()[1]).toBeEnabled()
    expect(down()[1]).toBeEnabled()
    fireEvent.click(up()[0])
    fireEvent.click(down()[2])
    expect(rows()).toEqual(['Жим', 'Присед', 'Тяга'])

    fireEvent.click(screen.getByRole('button', { name: 'Переместить вверх: Тяга, строка 3' }))
    expect(rows()).toEqual(['Жим', 'Тяга', 'Присед'])
    fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Жим, строка 1' }))
    expect(rows()).toEqual(['Тяга', 'Жим', 'Присед'])
    expect(up()[0]).toBeDisabled()
    expect(down()[2]).toBeDisabled()
    expect(up()[2]).toBeEnabled()
    expect(down()[0]).toBeEnabled()
    expect(within(screen.getAllByRole('listitem')[0]).getByText('5 подходов')).toBeInTheDocument()
    expect(within(screen.getAllByRole('listitem')[1]).getByText('3 подхода')).toBeInTheDocument()
    expect(within(screen.getAllByRole('listitem')[2]).getByText('2 подхода')).toBeInTheDocument()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить тренировку' })))
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ name: 'Программа', items: [
      { exerciseId: 'pull', sets: 5 },
      { exerciseId: 'press', sets: 3 },
      { exerciseId: 'squat', sets: 2 },
    ] })
  })

  it('moves repeated exercises independently with their own sets', async () => {
    const onSave = vi.fn().mockResolvedValue(undefined)
    render(<TemplateEditor title="Тренировка" exercises={[]} initialName="Повторы"
      initialItems={[
        { exerciseId: 'press', name: 'Жим', sets: 2 },
        { exerciseId: 'press', name: 'Жим', sets: 5 },
        { exerciseId: 'squat', name: 'Присед', sets: 3 },
      ]} onSave={onSave} />)

    fireEvent.click(screen.getByRole('button', { name: 'Переместить вверх: Жим, строка 2' }))
    expect(within(screen.getAllByRole('listitem')[0]).getByText('5 подходов')).toBeInTheDocument()
    expect(within(screen.getAllByRole('listitem')[1]).getByText('2 подхода')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Переместить вниз: Жим, строка 2' }))
    expect(within(screen.getAllByRole('listitem')[2]).getByText('2 подхода')).toBeInTheDocument()

    await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Сохранить тренировку' })))
    expect(onSave).toHaveBeenCalledExactlyOnceWith({ name: 'Повторы', items: [
      { exerciseId: 'press', sets: 5 },
      { exerciseId: 'squat', sets: 3 },
      { exerciseId: 'press', sets: 2 },
    ] })
  })

  it('disables both directions for a single row', () => {
    render(<TemplateEditor title="Тренировка" exercises={[]}
      initialItems={[{ exerciseId: 'press', name: 'Жим', sets: 3 }]}
      onSave={vi.fn()} />)

    expect(screen.getByRole('button', { name: 'Переместить вверх: Жим, строка 1' })).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Переместить вниз: Жим, строка 1' })).toBeDisabled()
  })

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
    const moves = screen.getAllByRole('button', { name: /^Переместить (вверх|вниз):/ })
    for (const move of moves) {
      expect(move).toBeDisabled()
      fireEvent.click(move)
    }
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
    expect(screen.getByRole('button', { name: 'Переместить вниз: Жим, строка 1' })).toBeEnabled()
    expect(screen.getByRole('button', { name: 'Переместить вверх: Присед, строка 2' })).toBeEnabled()

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
