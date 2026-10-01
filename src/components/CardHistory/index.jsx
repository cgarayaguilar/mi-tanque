import React from 'react'
import { useTheme } from 'styled-components'
import TextGroup from 'components/TextGroup'
import Typography from 'components/Typography'
import {
  Wrapper,
  Header,
  Text,
  Results,
  BarContainer,
  Bar,
  BarProgress,
} from './styles'
import { IoMdCalendar as CalendarIcon } from 'react-icons/io'
import { IoMdPin as MarkerPin } from 'react-icons/io'
import { formatDistanceToNow } from 'date-fns'
import { es as esNI } from 'date-fns/locale'

function CardHistory({ measurement, tankCapacity }) {
  const theme = useTheme()
  const { date, inches, gallons, liters, location, fuelHeight } = measurement

  return (
    <Wrapper>
      <Header>
        <Text>
          <CalendarIcon />
          <Typography
            ml="5px"
            variant="caption"
            value={formatDistanceToNow(date, {
              locale: esNI,
            })}
          />
        </Text>
        <Text>
          <MarkerPin />
          <Typography ml="5px" variant="caption" value={location} />
        </Text>
      </Header>
      <Results>
        <TextGroup size="small" label="Pulgadas" value={inches} />
        <TextGroup size="small" label="Galones" value={gallons} />
        <TextGroup size="small" label="Litros" value={liters} />
      </Results>
      <BarContainer>
        <Typography
          mr="5px"
          variant="caption"
          color={theme.accent}
          value={`${Math.round(fuelHeight)}%`}
        />
        <div>
          <Bar>
            <BarProgress width={`${Math.round(fuelHeight)}%`}></BarProgress>
          </Bar>
          <Typography
            mt="5px"
            variant="caption"
            value={`${gallons} galones / ${tankCapacity} galones`}
          />
        </div>
      </BarContainer>
    </Wrapper>
  )
}

export default React.memo(CardHistory)
