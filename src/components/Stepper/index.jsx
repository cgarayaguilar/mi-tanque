import { useContext, useRef, useState } from 'react'
import CardOfTank from 'components/CardOfTank'
import Typography from 'components/Typography'
import TextField from 'components/TextField'
import Button from 'components/Button'
import { StepContainer, BadgeContainer, Badge, Line, Step } from './styles'
import { useLocation } from 'wouter'
import { AppContext } from 'store'
import { convertGallonsToLiters } from 'utils/converts'
import { calcFuelLevel } from 'utils/calcFuelLevel'
import Swal from 'sweetalert2'
import { validationAlert } from 'utils/alerts'

export default function Stepper({ onCalcFuelLevel, resetValues }) {
  const { defaultTank } = useContext(AppContext)

  const [_, setLocation] = useLocation()
  const form = useRef(null)
  const [isSaving, setIsSaving] = useState(false)
  // Blocks a second submit before React re-renders the disabled button (§8.6)
  const savingRef = useRef(false)

  const selectTank = () => {
    setLocation('/tanques')
  }

  const handleSubmit = async event => {
    event.preventDefault()
    if (savingRef.current) return

    const formData = new FormData(form.current)
    const inches = Number(formData.get('inches'))

    //Validaciones
    if (inches < 1)
      return validationAlert(
        'Ingresa la cantidad de pulgadas que tiene de combustible tu tanque actualmente'
      )

    if (inches > defaultTank.diameter) {
      form.current.reset()
      resetValues()

      return Swal.fire({
        icon: 'error',
        title: 'Oops...',
        text: 'La cantidad de pulgadas supera la capacidad del tanque!',
      })
    }

    const gallons = calcFuelLevel({
      tankDiameter: Number(defaultTank.diameter),
      tankLength: Number(defaultTank.length),
      fuelHeight: inches,
    })

    const liters = convertGallonsToLiters({ gallons })

    const fuelHeight = (inches / defaultTank.diameter) * 100

    const results = {
      inches,
      gallons: gallons.toFixed(2),
      liters: liters.toFixed(2),
      fuelHeight: fuelHeight.toFixed(2),
    }

    savingRef.current = true
    setIsSaving(true)
    try {
      await onCalcFuelLevel(results)
    } finally {
      savingRef.current = false
      setIsSaving(false)
    }
  }

  return (
    <StepContainer onSubmit={handleSubmit} ref={form}>
      <Step>
        <BadgeContainer>
          <Badge completed={true}>1</Badge>
          <Line></Line>
        </BadgeContainer>

        <div>
          <Typography mb="4px" value="Elija un  tanque" variant="title2" />
          <CardOfTank
            capacity={defaultTank.capacity}
            diameter={defaultTank.diameter}
            length={defaultTank.length}
            ctaText="Cambiar tanque"
            onClick={selectTank}
          />
        </div>
      </Step>
      <Step>
        <BadgeContainer>
          <Badge completed={false}>2</Badge>
          <Line></Line>
        </BadgeContainer>
        <TextField
          type="number"
          name="inches"
          placeholder="Ingrese la cantidad de pulgadas"
        />
      </Step>
      <Step>
        <BadgeContainer>
          <Badge completed={false}>3</Badge>
        </BadgeContainer>
        <Button
          variant="filled"
          size="large"
          type="submit"
          disabled={isSaving}
          aria-busy={isSaving}
        >
          {isSaving ? 'Guardando…' : 'Calcular'}
        </Button>
      </Step>
    </StepContainer>
  )
}
