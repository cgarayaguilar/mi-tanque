import { useState } from 'react'
import {
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from '@testing-library/react'
import FilterChip, { FilterToggle } from 'components/FilterChip'
import { filterBy, filterChip } from '../../testing/filterBy'

const CAPACITIES = [50, 70, 80, 90, 100, 110, 120, 125, 135, 150, 200].map(
  value => ({ value, label: `${String(value)} gal` })
)

function Capacity({
  initial = null,
  options = CAPACITIES,
}: {
  initial?: number | null
  options?: { value: number; label: string }[]
}) {
  const [value, setValue] = useState<number | null>(initial)
  return (
    <>
      <FilterChip
        label="Capacidad"
        allLabel="Todas"
        options={options}
        value={value}
        onChange={setValue}
      />
      <output>{value ?? 'sin filtro'}</output>
    </>
  )
}

const menu = () => screen.getByRole('menu', { name: 'Capacidad' })

// specs/0017 RF-1, RF-3, RF-4
test('a chosen value fills the chip, and its × takes it away', async () => {
  render(<Capacity />)
  expect(filterChip('Capacidad')).toHaveTextContent('Capacidad')
  expect(filterChip('Capacidad')).toHaveAttribute('aria-haspopup', 'menu')

  await filterBy('Capacidad', '120 gal')
  expect(screen.getByText('120')).toBeInTheDocument()
  expect(
    screen.getByRole('button', { name: 'Capacidad: 120 gal' })
  ).toHaveTextContent('120 gal')
  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull()
  })

  // The menu marks the chosen one, after "Todas"
  fireEvent.click(filterChip('Capacidad'))
  const items = within(menu()).getAllByRole('menuitemradio')
  expect(items[0]).toHaveTextContent('Todas')
  expect(
    within(menu()).getByRole('menuitemradio', { name: '120 gal' })
  ).toHaveAttribute('aria-checked', 'true')
  fireEvent.keyDown(menu(), { key: 'Escape' })
  await waitFor(() => {
    expect(screen.queryByRole('menu')).toBeNull()
  })
  expect(screen.getByText('120')).toBeInTheDocument()

  fireEvent.click(
    screen.getByRole('button', { name: 'Quitar filtro Capacidad' })
  )
  expect(screen.getByText('sin filtro')).toBeInTheDocument()
  expect(
    screen.queryByRole('button', { name: 'Quitar filtro Capacidad' })
  ).toBeNull()
})

// specs/0017 RF-5, CA-2
test('a long list brings a search field', async () => {
  render(<Capacity />)
  fireEvent.click(filterChip('Capacidad'))
  const search = within(menu()).getByRole('searchbox', {
    name: 'Buscar capacidad',
  })
  fireEvent.change(search, { target: { value: '12' } })
  expect(
    within(menu())
      .getAllByRole('menuitemradio')
      .map(item => item.textContent)
  ).toEqual(['120 gal', '125 gal'])

  fireEvent.change(search, { target: { value: '999' } })
  expect(within(menu()).getByText('Sin resultados')).toBeInTheDocument()

  // Enter picks the first match
  fireEvent.change(search, { target: { value: '13' } })
  fireEvent.keyDown(search, { key: 'Enter' })
  expect(await screen.findByText('135')).toBeInTheDocument()
})

test('a short list has no search field', () => {
  render(<Capacity options={CAPACITIES.slice(0, 3)} />)
  fireEvent.click(filterChip('Capacidad'))
  expect(within(menu()).queryByRole('searchbox')).toBeNull()
})

// specs/0017 RF-7: a list that opens already filtered
test('a chip can start chosen', () => {
  render(<Capacity initial={100} />)
  expect(filterChip('Capacidad')).toHaveAccessibleName('Capacidad: 100 gal')
})

// specs/0017 RF-10
test('a toggle filter turns on and off', () => {
  function Archived() {
    const [on, setOn] = useState(false)
    return <FilterToggle label="Archivados" on={on} onChange={setOn} />
  }
  render(<Archived />)
  const chip = screen.getByRole('button', { name: 'Archivados' })
  expect(chip).toHaveAttribute('aria-pressed', 'false')
  fireEvent.click(chip)
  expect(chip).toHaveAttribute('aria-pressed', 'true')
  fireEvent.click(chip)
  expect(chip).toHaveAttribute('aria-pressed', 'false')
})

// specs/0017 RF-4, CA-5: the arrows move through the menu, Enter picks
test('the menu works with the keyboard', async () => {
  render(<Capacity options={CAPACITIES.slice(0, 3)} />)
  fireEvent.click(filterChip('Capacidad'))
  // It opens on the chosen option: "Todas"
  await waitFor(() => {
    expect(document.activeElement).toBe(
      within(menu()).getByRole('menuitemradio', { name: 'Todas' })
    )
  })
  fireEvent.keyDown(menu(), { key: 'ArrowDown' })
  fireEvent.keyDown(menu(), { key: 'ArrowDown' })
  expect(document.activeElement).toBe(
    within(menu()).getByRole('menuitemradio', { name: '70 gal' })
  )
  fireEvent.keyDown(document.activeElement as Element, { key: 'Enter' })
  expect(await screen.findByText('70')).toBeInTheDocument()
})
