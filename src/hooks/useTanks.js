import { useState, useMemo } from 'react'
import { sileo } from 'sileo'
import { createTank, readTanks, seedPredefinedTanks } from 'services/tanks'
import { reportError } from 'utils/reportError'

export default function useTank() {
  const [tanks, setTanks] = useState(null)
  const [keyword, setKeyword] = useState('')

  const updateKeyword = _keyword => setKeyword(_keyword)

  // Resolves with the saved tank; the caller reports failures and informs the user
  const saveTank = ({ capacity, diameter, length }) =>
    createTank({ capacity, diameter, length })

  const doesThisTankExist = async ({ capacity, diameter, length }) => {
    const tanks = await readTanks()

    return tanks.some(
      tank =>
        tank.capacity === Number(capacity) &&
        tank.diameter === Number(diameter) &&
        tank.length === Number(length)
    )
  }

  const getTanks = () => {
    // The predefined tanks are added the first time the app loads
    seedPredefinedTanks()
      .then(() => readTanks())
      .then(tanks => setTanks(tanks))
      .catch(error => {
        reportError(error, { operation: 'loadTanks' })
        sileo.error({
          title: 'No pudimos cargar los tanques',
          description: 'Recarga la página para reintentar.',
        })
      })
  }

  const filteredTanks = useMemo(() => {
    if (!tanks) return []
    if (!keyword) return tanks

    return tanks.filter(tank => {
      return (
        String(tank.capacity).toLowerCase().includes(keyword.toLowerCase()) ||
        String(tank.diameter).toLowerCase().includes(keyword.toLowerCase()) ||
        String(tank.length).toLowerCase().includes(keyword.toLowerCase())
      )
    })
  }, [tanks, keyword])

  return {
    getTanks,
    saveTank,
    doesThisTankExist,
    filteredTanks,
    keyword,
    updateKeyword,
  }
}
