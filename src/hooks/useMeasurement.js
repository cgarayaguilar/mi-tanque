import { useEffect, useState } from 'react'
import {
  createMeasurement,
  readMeasurementsByDateRanges,
} from 'services/measurements'
import { readTanks } from 'services/tanks'
import { endOfDay, startOfDay, subDays } from 'date-fns'
import { sileo } from 'sileo'
import { reportError } from 'utils/reportError'

const initialTotalState = {
  start: 0,
  end: 0,
  consumed: 0,
}

export default function useMeasurement() {
  const [listOfTanks, setListOfTanks] = useState(null)
  const [totalGallons, setTotalGallons] = useState(initialTotalState)

  // Whole days: from the start of the first day to the end of the last one
  const [date, setDate] = useState(() => ({
    start: startOfDay(subDays(new Date(), 7)),
    end: endOfDay(new Date()),
  }))

  //Muestra la fecha seleccionada en la interfaz
  const onSelectDate = _date => {
    if (!_date) return

    // endOfDay, not addHours(end, 23.59): date-fns truncates that to 23 hours,
    // which dropped the last hour, and re-applying a range kept shifting it
    setDate({
      start: startOfDay(_date.startDate),
      end: endOfDay(_date.endDate),
    })
  }

  // Resolves with the saved id; the caller reports failures and informs the user
  const saveMeasurement = measurement => createMeasurement(measurement)

  const getIdsOfTanks = ({ data }) => {
    if (!data) return []
    const ids = data.map(measurement => measurement.tankId)

    //Eliminar tanques duplicados
    const uniques = ids.filter((value, index) => {
      return ids.indexOf(value) === index
    })

    //retornar la lista de tanques
    return uniques
  }

  const getTanksDetails = async ({ idsTanks }) => {
    if (!Array.isArray(idsTanks) || idsTanks.length < 1) return []

    const allTanks = await readTanks()

    //Recorrer la los ids de los tanques para obtener el detalle de cada tanque
    const tanksWithDetails = idsTanks.map(id =>
      allTanks.find(tank => tank.id === Number(id))
    )

    //Descartar mediciones de tanques que ya no existen en la base de datos
    return tanksWithDetails.filter(Boolean)
  }

  const getNameOfCity = async ({ latitude, longitude }) => {
    try {
      const response = await fetch(
        `https://app.geocodeapi.io/api/v1/reverse?point.lat=${latitude}&point.lon=${longitude}&apikey=6384fa00-7b09-11eb-b491-2511be64546d`
      )

      const data = await response.json()
      const location = data?.features[0].properties

      return `${location.locality}, ${location.country}`
    } catch (error) {
      // The place name is optional: without it the measurement is still saved.
      // Being offline is expected, so only report failures while online.
      if (navigator.onLine) reportError(error, { operation: 'reverseGeocode' })
      return 'Sin ubicación'
    }
  }

  const getMeasurementsByTank = ({ id, data }) => {
    if (Array.isArray(data)) {
      const _measurements = data.filter(
        measurement => Number(measurement.tankId) === Number(id)
      )

      return _measurements
    }
  }

  //isCancelled evita actualizar el estado si el componente se desmontó o cambió el periodo
  const getMeasurements = async ({ isCancelled }) => {
    try {
      const measurements = await readMeasurementsByDateRanges({
        startDate: date.start,
        endDate: date.end,
      })

      if (isCancelled()) return

      //Sin mediciones en el periodo: la interfaz muestra el mensaje de lista vacía
      if (!Array.isArray(measurements) || measurements.length < 1) {
        setListOfTanks(null)
        setTotalGallons(initialTotalState)
        return
      }

      //Ordenar resultados
      measurements.sort((a, b) => {
        if (a.date < b.date) {
          return -1
        }
        if (a.date > b.date) {
          return 1
        }
        // a debe ser igual b
        return 0
      })

      //Obtener los ids de cada tanque
      const idsTanks = getIdsOfTanks({ data: measurements })

      //Obtener detalle de tanques mediante ids
      const tanksWithDetails = await getTanksDetails({ idsTanks })

      if (isCancelled()) return

      //Asociar mediciones a cada tanque
      const tanksWithMeasurements = tanksWithDetails.map(tank => ({
        tank: tank,
        measurements: getMeasurementsByTank({
          id: tank.id,
          data: measurements,
        }),
      }))

      setListOfTanks(
        tanksWithMeasurements.length > 0 ? tanksWithMeasurements : null
      )
      setTotalGallons({
        start: measurements[0].gallons,
        end: measurements[measurements.length - 1].gallons,
        consumed:
          Number(measurements[0].gallons) -
          Number(measurements[measurements.length - 1].gallons),
      })
    } catch (err) {
      if (isCancelled()) return

      setListOfTanks(null)
      setTotalGallons(initialTotalState)
      reportError(err, { operation: 'loadMeasurements' })
      sileo.error({
        title: 'No pudimos cargar el historial',
        description: 'Recarga la página para reintentar.',
      })
    }
  }

  useEffect(() => {
    let cancelled = false

    getMeasurements({ isCancelled: () => cancelled })

    return () => {
      cancelled = true
    }
  }, [date])

  return {
    saveMeasurement,
    getNameOfCity,
    listOfTanks,
    totalGallons,
    onSelectDate,
    date,
  }
}
