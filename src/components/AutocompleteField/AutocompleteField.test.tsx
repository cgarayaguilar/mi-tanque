import { fireEvent, render, screen } from '@testing-library/react'
import { AutocompleteBase } from 'components/AutocompleteField'
import { CURRENCY_OPTIONS } from 'schemas/account'

// Audit 2026-10-02: options with the same text (two organizations named
// "Flota de Juan") shared a React key, and rows could repeat or go missing
test('two options with the same text are two rows', () => {
  const error = vi.spyOn(console, 'error').mockImplementation(() => undefined)
  const onChange = vi.fn()
  render(
    <AutocompleteBase
      id="org"
      label="Organización activa"
      options={[
        { value: 'a', label: 'Flota de Juan' },
        { value: 'b', label: 'Flota de Juan' },
      ]}
      value="a"
      onChange={onChange}
    />
  )
  fireEvent.mouseDown(screen.getByLabelText('Organización activa'))
  const rows = screen.getAllByRole('option')
  expect(rows).toHaveLength(2)
  fireEvent.click(rows[1] as HTMLElement)
  expect(onChange).toHaveBeenCalledWith('b')
  expect(
    error.mock.calls.some(call => String(call[0]).includes('same key'))
  ).toBe(false)
  error.mockRestore()
})

// specs/0012 CA-1: a currency is found by its country or its code
test.each(['nicaragua', 'NIO', 'córdoba'])(
  'typing "%s" finds the córdoba',
  text => {
    render(
      <AutocompleteBase
        id="currency"
        label="Moneda"
        options={CURRENCY_OPTIONS}
        value=""
        onChange={vi.fn()}
      />
    )
    const input = screen.getByLabelText('Moneda')
    input.focus()
    fireEvent.change(input, { target: { value: text } })
    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      'Córdobas nicaragüenses (C$)',
    ])
  }
)

test('Enter picks the first match of the search', () => {
  const onChange = vi.fn()
  render(
    <AutocompleteBase
      id="currency"
      label="Moneda"
      options={CURRENCY_OPTIONS}
      value=""
      onChange={onChange}
    />
  )
  const input = screen.getByLabelText('Moneda')
  input.focus()
  fireEvent.change(input, { target: { value: 'hond' } })
  fireEvent.keyDown(input, { key: 'Enter' })
  expect(onChange).toHaveBeenCalledWith('HNL')
})

// backend specs/0028 RF-1
describe('"+ Crear …" at the top of the list', () => {
  const drivers = [
    { value: 'd1', label: 'Pedro Ruiz' },
    { value: 'd2', label: 'Marta Gómez' },
  ]
  const renderWith = (
    onCreate = vi.fn(),
    onChange = vi.fn(),
    withText = true
  ) => {
    render(
      <AutocompleteBase
        id="driver"
        label="Conductor"
        options={drivers}
        value=""
        onChange={onChange}
        create={{ label: 'Crear conductor', onCreate, withText }}
      />
    )
    return screen.getByLabelText('Conductor')
  }

  test('is the first row, also when nothing matches', () => {
    const input = renderWith()
    fireEvent.mouseDown(input)
    expect(screen.getAllByRole('option')[0]).toHaveTextContent(
      '+ Crear conductor'
    )
    input.focus()
    fireEvent.change(input, { target: { value: 'Zoila' } })
    expect(screen.getAllByRole('option').map(row => row.textContent)).toEqual([
      '+ Crear conductor «Zoila»',
    ])
  })

  test('opens its form with what was typed, and the value stays', () => {
    const onCreate = vi.fn()
    const onChange = vi.fn()
    const input = renderWith(onCreate, onChange)
    input.focus()
    fireEvent.change(input, { target: { value: '  Ana   Ruiz ' } })
    fireEvent.click(screen.getByRole('option', { name: /Crear conductor/ }))
    expect(onCreate).toHaveBeenCalledWith('Ana Ruiz')
    expect(onChange).not.toHaveBeenCalled()
  })

  test('a name that exists is not offered as new', () => {
    const input = renderWith()
    input.focus()
    fireEvent.change(input, { target: { value: 'marta gomez' } })
    expect(screen.getAllByRole('option')[0]).toHaveTextContent(
      /^\+ Crear conductor$/
    )
  })

  test('without the text (rates): only "+ Crear …"', () => {
    const onCreate = vi.fn()
    const input = renderWith(onCreate, vi.fn(), false)
    input.focus()
    fireEvent.change(input, { target: { value: 'León' } })
    fireEvent.click(screen.getByRole('option', { name: '+ Crear conductor' }))
    expect(onCreate).toHaveBeenCalledWith('')
  })

  test('Enter still picks the first match; with none, it creates', () => {
    const onCreate = vi.fn()
    const onChange = vi.fn()
    const input = renderWith(onCreate, onChange)
    input.focus()
    fireEvent.change(input, { target: { value: 'mar' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onChange).toHaveBeenCalledWith('d2')
    expect(onCreate).not.toHaveBeenCalled()

    fireEvent.change(input, { target: { value: 'Zoila' } })
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onCreate).toHaveBeenCalledWith('Zoila')
  })
})
