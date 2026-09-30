import React, { useState, useEffect } from 'react'
import Typography from 'components/Typography'
import Tank from 'components/Tank'
import { Card } from './styles.js'
import { useWindowWidth } from 'hooks/useWindowWidth'

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
    <Card onClick={onClick}>
      <Tank capacity={capacity} diameter={diameter} length={length} />

      <div>
        <Typography
          value={`Tanque de ${capacity} ${!isSmallDevice ? 'gls' : ''} `}
          variant="title3"
          mb="8px"
        />
        <Typography
          value={`Diametro: ${diameter}  ${
            !isSmallDevice ? 'pulgadas' : '"'
          }  `}
          variant="body"
          mb="4px"
        />
        <Typography
          value={`Longitud: ${length} ${!isSmallDevice ? 'pulgadas' : '"'}`}
          variant="body"
          mb="8px"
        />

        <Typography value={ctaText} variant="link2" />
      </div>
    </Card>
  )
}
