import React from 'react'
import { useTheme } from 'styled-components'
import Stat from 'components/Stat'
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
import { space } from 'theme/tokens'
import { px } from 'styles/type'

function CardHistory({ measurement, tankCapacity }) {
  const theme = useTheme()
  const { date, inches, gallons, liters, location, fuelHeight } = measurement

  return (
    <Wrapper>
      <Header>
        <Text>
          <CalendarIcon />
          <Typography
            ml={px(space.xxs)}
            variant="caption"
            value={formatDistanceToNow(date, {
              locale: esNI,
            })}
          />
        </Text>
        <Text>
          <MarkerPin />
          <Typography ml={px(space.xxs)} variant="caption" value={location} />
        </Text>
      </Header>
      <Results>
        <Stat size="small" label="Pulgadas" value={inches} />
        <Stat size="small" label="Galones" value={gallons} />
        <Stat size="small" label="Litros" value={liters} />
      </Results>
      <BarContainer>
        <Typography
          mr={px(space.xxs)}
          variant="caption"
          color={theme.accent}
          value={`${Math.round(fuelHeight)}%`}
        />
        <div>
          <Bar>
            <BarProgress width={`${Math.round(fuelHeight)}%`}></BarProgress>
          </Bar>
          <Typography
            mt={px(space.xxs)}
            variant="caption"
            value={`${gallons} galones / ${tankCapacity} galones`}
          />
        </div>
      </BarContainer>
    </Wrapper>
  )
}

export default React.memo(CardHistory)
