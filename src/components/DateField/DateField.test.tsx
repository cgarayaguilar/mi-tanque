import { useEffect } from 'react'
import { fireEvent, render, screen, within } from '@testing-library/react'
import { useForm, useWatch } from 'react-hook-form'
import DateField from 'components/DateField'

function Form({
  initial,
  onValue,
}: {
  initial: string
  onValue: (value: string | undefined) => void
}) {
  const { control } = useForm({
    defaultValues: { insuranceExpiresOn: initial },
  })
  const value = useWatch({ control, name: 'insuranceExpiresOn' })
  useEffect(() => {
    onValue(value)
  }, [value, onValue])
  return (
    <DateField
      id="insuranceExpiresOn"
      label="Vencimiento del seguro (opcional)"
      control={control}
      name="insuranceExpiresOn"
    />
  )
}

// specs/0011 CA-2
test('a saved date shows as dd/mm/aaaa, and a day picked is stored plain', async () => {
  const onValue = vi.fn()
  render(<Form initial="2026-11-10" onValue={onValue} />)
  expect(
    screen.getByLabelText('Vencimiento del seguro (opcional)')
  ).toHaveValue('10/11/2026')

  fireEvent.click(screen.getByRole('button', { name: /^Elige fecha/ }))
  const calendar = await screen.findByRole('grid')
  fireEvent.click(within(calendar).getByRole('gridcell', { name: '15' }))

  expect(onValue).toHaveBeenLastCalledWith('2026-11-15')
})

test('clearing the date stores nothing', () => {
  const onValue = vi.fn()
  render(<Form initial="2026-11-10" onValue={onValue} />)
  fireEvent.click(screen.getByRole('button', { name: 'Limpiar valor' }))
  expect(onValue).toHaveBeenLastCalledWith('')
})
