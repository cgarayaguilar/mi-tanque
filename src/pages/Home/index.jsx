import NavBar from 'components/NavBar'
import { useState, useEffect, useContext } from 'react'
import Stepper from 'components/Stepper'
import TankAnimation from 'components/TankAnimation'
import TextGroup from 'components/TextGroup'
import Typography from 'components/Typography'
import { AppContext } from 'store'
import { Container, Wrapper, Results, NavBarContainer } from './styles'
import { useLocation } from 'wouter'
import useMeasurement from 'hooks/useMeasurement'
import { getCurrentPosition } from 'utils/getCurrentPosition'
import { reportError } from 'utils/reportError'
import { sileo } from 'sileo'

const initialValues = {
  inches: 0,
  gallons: 0,
  liters: 0,
  fuelHeight: 0,
}

export default function Home() {
  //Estado que obtiene el tanque predeterminado
  const { defaultTank } = useContext(AppContext)
  //Funcion para redireccionar a otras paginas
  const [_, setLocation] = useLocation()
  //Funcion que guarda la medicion en la bbdd
  const { saveMeasurement, getNameOfCity } = useMeasurement()
  //Estado que guarda los resultados de la medicion
  const [results, seResults] = useState(initialValues)
  // One id per measurement: retries of the same save reuse it, so it can never
  // be stored twice (§4.1). A new one is created after each successful save.
  const [intentId, setIntentId] = useState(() => crypto.randomUUID())

  const resetValues = () => seResults(initialValues)

  /*Funcion que muestra lo resultados en la interfaz y guarda los resultados en la bbdd*/
  const onCalcFuelLevel = async _results => {
    seResults(_results)

    const date = new Date()
    const tankId = defaultTank.id

    try {
      //Latitud y longitud del usuario al momento de guardar la medicion
      const position = await getCurrentPosition()
      const location = position
        ? await getNameOfCity(position)
        : 'Sin ubicación'

      await saveMeasurement({ ..._results, date, location, tankId, intentId })
      setIntentId(crypto.randomUUID())
      sileo.success({ title: 'Medición guardada' })
    } catch (error) {
      reportError(error, { operation: 'createMeasurement', tankId })
      sileo.error({
        title: 'No pudimos guardar la medición',
        description: 'Reintenta en un momento.',
      })
    }
  }

  useEffect(() => {
    //Redireccionar  a la pantalla de tanques en el caso de que no haya un tanque preseleccionado por defecto
    if (Object.keys(defaultTank).length < 1) return setLocation('/tanques')
  }, [])

  return (
    <Container>
      <Wrapper>
        <Stepper onCalcFuelLevel={onCalcFuelLevel} resetValues={resetValues} />
        <Typography value={'Resultados'} variant="title2" mt="32px" />

        <Results>
          <TextGroup label="Pulgadas" value={results.inches} />
          <TextGroup label="Galones" value={results.gallons} />
          <TextGroup label="Litros" value={results.liters} />
        </Results>
        <TankAnimation
          fuelHeight={results.fuelHeight}
          gallons={results.gallons}
        />
      </Wrapper>
      <NavBarContainer>
        <NavBar activeTab={2} />
      </NavBarContainer>
    </Container>
  )
}
