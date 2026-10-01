import { useState, useMemo } from 'react'
import { createTank, readTanks, seedPredefinedTanks } from 'services/tanks'

export default function useTank() {
  const [tanks, setTanks] = useState(null)
  const [keyword, setKeyword] = useState('')

  const updateKeyword = _keyword => setKeyword(_keyword)

  const saveTank = (tank, onSave = () => {}) => {
    const { capacity, diameter, length } = tank

    createTank({ capacity, diameter, length })
      .then(tankAddedID => {
        onSave(tankAddedID)
      })
      .catch(error => {
        console.error(error)
      })
  }

  const doesThisTankExist = async ({ capacity, diameter, length }) => {
    try {
      const tanks = await readTanks()

      const tankExist = tanks.some(tank => {
        return (
          Number(tank.capacity) === Number(capacity) &&
          Number(tank.diameter) === Number(diameter) &&
          Number(tank.length) === Number(length)
        )
      })

      return tankExist
    } catch (error) {
      console.error(error)
    }
  }

  const getTanks = () => {
    // The predefined tanks are added the first time the app loads
    seedPredefinedTanks()
      .then(() => readTanks())
      .then(tanks => setTanks(tanks))
      .catch(error => {
        console.error(error)
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
