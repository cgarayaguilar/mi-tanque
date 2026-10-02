import { fireEvent, render, screen } from '@testing-library/react'
import { AutocompleteBase } from 'components/AutocompleteField'

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
