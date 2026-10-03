import { render, screen } from '@testing-library/react'
import ChipRow from 'components/ChipRow'

const options = ['a', 'b', 'c', 'd'].map(value => ({
  value,
  label: `Opción ${value}`,
}))

// jsdom has no layout: each chip is 100px wide, side by side, in a 150px row
const stubLayout = () => {
  const chips = () => [...document.querySelectorAll('[aria-pressed]')]
  const spies = [
    vi
      .spyOn(HTMLElement.prototype, 'offsetLeft', 'get')
      .mockImplementation(function (this: HTMLElement) {
        return chips().indexOf(this) * 100
      }),
    vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(100),
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(150),
  ]
  return () => {
    spies.forEach(spy => {
      spy.mockRestore()
    })
  }
}

const row = () =>
  screen.getByRole('group', { name: 'Modelo' }).lastElementChild as HTMLElement

// specs/0016 RF-6: a catalog that opens filtered by the truck shows its model
test('a row that opens on a chip past the edge slides to it', () => {
  const restore = stubLayout()
  render(
    <ChipRow
      label="Modelo"
      allLabel="Todos"
      options={options}
      value="c"
      onChange={vi.fn()}
    />
  )
  // "c" is the fourth chip, after "Todos": it starts at 300px
  expect(row().scrollLeft).toBeGreaterThan(150)
  restore()
})

test('a row whose chosen chip is in sight stays put', () => {
  const restore = stubLayout()
  render(
    <ChipRow
      label="Modelo"
      allLabel="Todos"
      options={options}
      value={null}
      onChange={vi.fn()}
    />
  )
  expect(row().scrollLeft).toBe(0)
  restore()
})
