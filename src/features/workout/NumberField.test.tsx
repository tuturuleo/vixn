import { useState } from 'react'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { METRIC_META, type MetricType } from '@/domain/metrics'
import { NumberField } from './NumberField'

function ControlledField({
  initialValue = null,
  metric = 'weight',
  onChange,
}: {
  initialValue?: number | null
  metric?: MetricType
  onChange: (value: number | null) => void
}) {
  const [value, setValue] = useState(initialValue)
  return (
    <NumberField
      metric={metric}
      value={value}
      onChange={(next) => {
        setValue(next)
        onChange(next)
      }}
    />
  )
}

describe('NumberField', () => {
  it.each(['.', ','])('preserves %s during sequential decimal input and autosave', async (separator) => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledField onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.type(input, `60${separator}`)
    expect(input).toHaveValue(`60${separator}`)
    expect(onChange).toHaveBeenLastCalledWith(60)

    await user.type(input, '5')
    expect(input).toHaveValue(`60${separator}5`)
    expect(onChange).toHaveBeenLastCalledWith(60.5)

    await user.tab()
    expect(input).toHaveValue('60.5')
  })

  it('emits null on clearing and accepts zero', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledField initialValue={60} onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.clear(input)
    expect(input).toHaveValue('')
    expect(onChange).toHaveBeenLastCalledWith(null)
    await user.tab()
    expect(input).toHaveValue('')

    await user.type(input, '0')
    expect(onChange).toHaveBeenLastCalledWith(0)
    await user.tab()
    expect(input).toHaveValue('0')
  })

  it.each([
    ['weight', '60.56', 60.6],
    ['reps', '10.6', 11],
    ['duration', '10.6', 11],
    ['distance', '10.6', 11],
  ] as const)('normalizes %s precision on blur', async (metric, text, expected) => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledField metric={metric} onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.type(input, text)
    expect(input).toHaveValue(text)
    expect(onChange).toHaveBeenLastCalledWith(expected)
    await user.tab()
    expect(input).toHaveValue(String(expected))
  })

  it.each(['weight', 'reps', 'duration', 'distance'] as const)(
    'keeps the %s step and lower bound',
    async (metric) => {
      const user = userEvent.setup()
      const onChange = vi.fn()
      const meta = METRIC_META[metric]
      render(<ControlledField metric={metric} initialValue={0.1} onChange={onChange} />)
      const less = screen.getByRole('button', { name: `${meta.label}: меньше` })
      const more = screen.getByRole('button', { name: `${meta.label}: больше` })

      await user.click(less)
      expect(onChange).toHaveBeenLastCalledWith(0)
      expect(screen.getByRole('textbox')).toHaveValue('0')
      expect(less).toBeDisabled()

      await user.click(more)
      expect(onChange).toHaveBeenLastCalledWith(meta.step)
      expect(screen.getByRole('textbox')).toHaveValue(String(meta.step))
      await user.click(less)
      expect(onChange).toHaveBeenLastCalledWith(0)
    },
  )

  it('reflects an external value update while editing', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<NumberField metric="weight" value={60} onChange={onChange} />)
    const input = screen.getByRole('textbox')
    await user.type(input, ',')
    expect(input).toHaveValue('60,')

    rerender(<NumberField metric="weight" value={75.5} onChange={onChange} />)
    expect(input).toHaveValue('75.5')
    rerender(<NumberField metric="weight" value={null} onChange={onChange} />)
    expect(input).toHaveValue('')
  })

  it('resets the draft when the set key changes, including equal values', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { rerender } = render(<NumberField key="session:0:0:weight" metric="weight" value={60} onChange={onChange} />)
    await user.type(screen.getByRole('textbox'), '.')
    expect(screen.getByRole('textbox')).toHaveValue('60.')

    rerender(<NumberField key="session:0:1:weight" metric="weight" value={60} onChange={onChange} />)
    expect(screen.getByRole('textbox')).toHaveValue('60')
    rerender(<NumberField key="session:0:2:weight" metric="weight" value={80.5} onChange={onChange} />)
    expect(screen.getByRole('textbox')).toHaveValue('80.5')
  })

  it('never emits negative or non-finite numbers', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    render(<ControlledField initialValue={10} onChange={onChange} />)
    const input = screen.getByRole('textbox')

    await user.clear(input)
    await user.type(input, '-5')
    expect(onChange).toHaveBeenLastCalledWith(0)
    await user.tab()
    expect(input).toHaveValue('0')

    await user.clear(input)
    await user.type(input, '1e309')
    expect(onChange.mock.calls.every(([value]) => value === null || (Number.isFinite(value) && value >= 0))).toBe(true)
    await user.tab()
    expect(input).toHaveValue('1e+30')
  })
})
