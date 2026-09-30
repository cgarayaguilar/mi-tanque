import React, { useContext, useState } from 'react'
import { useLocation } from 'wouter'
import { AppContext } from 'store'
import useTanks from 'hooks/useTanks'
import { validationAlert, successAlert } from 'utils/alerts'

//Import components
import TextField from 'components/TextField'
import Tank from 'components/Tank'
import Button from 'components/Button'
//Import Icons
import { CgArrowsV as DiameterIcon } from 'react-icons/cg'
import { CgArrowsH as LengthIcon } from 'react-icons/cg'
import { Wrapper, Form, TankContainer, ButtonsContainer } from './styles'

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

  //Funcion que se ejecuta cuando se hace submit para guardar un nuevo tanque
  const handleSubmit = async event => {
    event.preventDefault()

    //Validaciones
    if (capacity < 10 || capacity > 250)
      return validationAlert('Ingresa una capacidad valida para tu tanque')
    if (diameter < 10 || diameter > 99)
      return validationAlert('Ingresa un diametro valido para tu tanque')
    if (length < 10 || length > 150)
      return validationAlert('Ingresa una longitud valida para tu tanque')

    const exists = await doesThisTankExist({ capacity, diameter, length })

    if (exists) return validationAlert('Ya existe un tanque con estas medidas')

    const tank = {
      capacity,
      diameter,
      length,
    }

    saveTank(tank, tankAddedID => {
      //Limpiar campos
      setCapacity('')
      setDiameter('')
      setLength('')
      //Seleccionar tanque agregado como predeterminado
      addTankForDefault({ tank: { ...tank, id: tankAddedID } })
      successAlert('Tanque agregado correctamente')
      //Redireccionar a la home
      setLocation('/')
    })
  }

  //Redireccionar a la home
  const cancel = () => setLocation('/tanques')

  return (
    <Wrapper>
      <Form onSubmit={handleSubmit} id="formTank">
        <TextField
          mb="16px"
          type="number"
          label="Capacidad en galones de su tanque"
          placeholder="Ej. 100, 150, 200"
          value={capacity}
          onChange={e => setCapacity(e.target.value)}
        />
        <TextField
          mb="16px"
          type="number"
          label="Diámetro en pulgadas de su tanque"
          placeholder="Ej. 100, 150, 200"
          Icon={DiameterIcon}
          value={diameter}
          onChange={e => setDiameter(e.target.value)}
        />
        <TextField
          mb="16px"
          type="number"
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
          mb="8px"
          variant="filled"
          size="large"
          type="submit"
          form="formTank"
        >
          Guardar
        </Button>
        <Button variant="outline" size="large" onClick={cancel}>
          Cancelar
        </Button>
      </ButtonsContainer>
    </Wrapper>
  )
}
