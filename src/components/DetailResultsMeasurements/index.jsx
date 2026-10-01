import Stat from 'components/Stat'
import Typography from 'components/Typography'
import React from 'react'
import { Wrapper, Results } from './styles'
import { format } from 'date-fns'

function DetailResultsMeasurements({ totalGallons, date }) {
  const { start, end, consumed } = totalGallons
  const { start: startDate, end: endDate } = date

  return (
    <Wrapper>
      <Typography value="Galones de combustible" variant="title3" />
      <Results>
        <Stat
          size="small"
          label="Al iniciar"
          value={`${start} gls`}
          caption={format(startDate, 'd/M/yy')}
        />
        <Stat
          size="small"
          label="Al finalizar"
          value={`${end} gls`}
          caption={format(endDate, 'd/M/yy')}
        />
        <Stat
          size="small"
          label="Diferencia"
          value={`${consumed.toFixed(2)} gls`}
          caption={`Del ${format(startDate, 'd/M/yy')} al ${format(
            endDate,
            'd/M/yy'
          )}`}
        />
      </Results>
    </Wrapper>
  )
}

export default React.memo(DetailResultsMeasurements)
