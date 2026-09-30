import React, { useContext, useEffect } from 'react'
import { useLocation } from 'wouter'
import CardOfTank from 'components/CardOfTank'
import Typography from 'components/Typography'
import { Wrapper, ListOfTanks, LinkContainer } from './styles'
import TextField from 'components/TextField'
import Button from 'components/Button'
import useTanks from 'hooks/useTanks'
import { AppContext } from 'store'

export default function TankSearch() {
  const { addTankForDefault } = useContext(AppContext)

  const { getTanks, keyword, updateKeyword, filteredTanks } = useTanks()

  const [_, setLocation] = useLocation()

  const selectTank = tank => {
    addTankForDefault({ tank })
    setLocation('/')
  }

  //Cargar los tanques al montar el componente
  useEffect(() => {
    getTanks()
  }, [])

  return (
    <Wrapper>
      <TextField
        value={keyword}
        onChange={e => updateKeyword(e.target.value)}
        placeholder="Buscar tanque"
        search={true}
      />

      <Typography
        mt="24px"
        mb="8px"
        value="Seleccione su tanque"
        variant="title2"
      />
      <ListOfTanks>
        {filteredTanks &&
          filteredTanks.map(tank => (
            <CardOfTank
              key={tank.id}
              capacity={tank.capacity}
              diameter={tank.diameter}
              length={tank.length}
              ctaText="Seleccionar"
              onClick={() => selectTank(tank)}
            />
          ))}
        {filteredTanks.length === 0 && (
          <Typography variant="body" value="No se encontraron tanques" />
        )}
      </ListOfTanks>
      <LinkContainer>
        <Typography value="¿Tu tanque no aparece?" variant="title3" />
        <Button
          variant="link"
          size="medium"
          onClick={() => setLocation('/tanques/crear')}
        >
          Agregar tanque
        </Button>
      </LinkContainer>
    </Wrapper>
  )
}
