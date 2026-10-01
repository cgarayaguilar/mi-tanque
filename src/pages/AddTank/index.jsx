import { useContext, useRef, useState } from 'react'
import { useLocation } from 'wouter'
import { AppContext } from 'store'
import useTanks from 'hooks/useTanks'
import { tankDimensionsSchema } from 'schemas/tank'
import { parseDecimal } from 'utils/parseDecimal'
import { reportError } from 'utils/reportError'
import { sileo } from 'sileo'

//Import components
import TextField from 'components/TextField'
import Tank from 'components/Tank'
import Button from 'components/Button'
//Import Icons
import { CgArrowsV as DiameterIcon } from 'react-icons/cg'
import { CgArrowsH as LengthIcon } from 'react-icons/cg'
import { Wrapper, Form, TankContainer, ButtonsContainer } from './styles'
import { space } from 'theme/tokens'
import { px } from 'styles/type'

export default function AddTank() {
  //Funcion que guarda el tanque por defecto
  const { addTankForDefault } = useContext(AppContext)
  //Funcion para redireccionar a otras rutas
  const [_, setLocation] = useLocation()
  const { saveTank, doesThisTankExist } = useTanks()

  //Estados para gestionar los inputs del tanque
  const [capacity, setCapacity] = useState('')
  const [diameter, setDiameter] = useState('')
  const [length, setLength] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Blocks a second submit before React re-renders the disabled button (§8.6)
  const savingRef = useRef(false)

  //Funcion que se ejecuta cuando se hace submit para guardar un nuevo tanque
  const handleSubmit = async event => {
    event.preventDefault()
    if (savingRef.current) return

    // Same schema the storage layer enforces (§8.7)
    const validation = tankDimensionsSchema.safeParse({
      capacity: parseDecimal(capacity),
      diameter: parseDecimal(diameter),
      length: parseDecimal(length),
    })
    if (!validation.success)
      return sileo.warning({
        title: 'Revisa las medidas del tanque',
        description: validation.error.issues[0]?.message,
      })

    savingRef.current = true
    setIsSaving(true)
    try {
      const dimensions = validation.data
      const exists = await doesThisTankExist(dimensions)

      if (exists)
        return sileo.warning({
          title: 'Ese tanque ya existe',
          description:
            'Ya tienes un tanque con estas medidas: elígelo en la lista.',
        })

      const newTank = await saveTank(dimensions)

      //Limpiar campos
      setCapacity('')
      setDiameter('')
      setLength('')
      //Seleccionar tanque agregado como predeterminado
      addTankForDefault({ tank: newTank })
      sileo.success({ title: 'Tanque agregado' })
      //Redireccionar a la home
      setLocation('/')
    } catch (error) {
      reportError(error, {
        operation: 'createTank',
        capacity,
        diameter,
        length,
      })
      sileo.error({
        title: 'No pudimos guardar el tanque',
        description: 'Reintenta en un momento.',
      })
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  //Redireccionar a la home
  const cancel = () => setLocation('/tanques')

  return (
    <Wrapper>
      {/* noValidate: our checks report through Sileo, not the browser's bubbles */}
      <Form onSubmit={handleSubmit} id="formTank" noValidate>
        <TextField
          mb={px(space.base)}
          inputMode="decimal"
          autoComplete="off"
          label="Capacidad en galones de su tanque"
          placeholder="Ej. 100, 150, 200"
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
        />
        <TextField
          mb={px(space.base)}
          inputMode="decimal"
          autoComplete="off"
          label="Diámetro en pulgadas de su tanque"
          placeholder="Ej. 100, 150, 200"
          Icon={DiameterIcon}
          value={diameter}
          onChange={e => setDiameter(e.target.value)}
        />
        <TextField
          mb={px(space.base)}
          inputMode="decimal"
          autoComplete="off"
          label="Longitud en pulgadas de su tanque"
          placeholder="Ej. 22, 23, 25"
          Icon={LengthIcon}
          value={length}
          onChange={e => setLength(e.target.value)}
        />
      </Form>
      <TankContainer>
        <Tank
          capacity={capacity}
          diameter={diameter}
          length={length}
          lineWidth="1px"
        />
      </TankContainer>

      <ButtonsContainer>
        <Button
          variant="filled"
          size="large"
          type="submit"
          form="formTank"
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? 'Guardando…' : 'Guardar'}
        </Button>
        <Button variant="outline" size="large" onClick={cancel}>
          Cancelar
        </Button>
      </ButtonsContainer>
    </Wrapper>
  )
}
