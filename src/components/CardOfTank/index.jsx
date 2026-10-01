import { useState, useEffect } from 'react'
import Typography from 'components/Typography'
import Tank from 'components/Tank'
import { Card } from './styles.js'
import { useWindowWidth } from 'hooks/useWindowWidth'
import { space } from 'theme/tokens'
import { px } from 'styles/type'

export default function CardOfTank({
  capacity,
  diameter,
  length,
  ctaText = 'Seleccionar',
  onClick = () => {},
}) {
  //Obtenemos de manera imperativa el ancho de la pantalla
  const windowWidth = useWindowWidth()
  const [isSmallDevice, setIsSmallDevice] = useState(false)

  //Obtener el ancho de la ventana del navegador
  useEffect(() => {
    windowWidth >= 340 ? setIsSmallDevice(false) : setIsSmallDevice(true)
  }, [windowWidth])

  return (
    <Card
      type="button"
      onClick={onClick}
      aria-label={`${ctaText}: tanque de ${capacity} galones, ${diameter} por ${length} pulgadas`}
    >
      <Tank capacity={capacity} diameter={diameter} length={length} />

      <div>
        <Typography
          value={`Tanque de ${capacity} ${!isSmallDevice ? 'gls' : ''} `}
          variant="title3"
          mb={px(space.xs)}
        />
        <Typography
          value={`Diámetro: ${diameter}  ${
            !isSmallDevice ? 'pulgadas' : '"'
          }  `}
          variant="caption"
          mb={px(space.xxs)}
        />
        <Typography
          value={`Longitud: ${length} ${!isSmallDevice ? 'pulgadas' : '"'}`}
          variant="caption"
          mb={px(space.xs)}
        />

        <Typography value={ctaText} variant="link2" />
      </div>
    </Card>
  )
}
