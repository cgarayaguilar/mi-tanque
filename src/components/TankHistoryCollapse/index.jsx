import CardHistory from 'components/CardHistory'
import React, { useState } from 'react'
import Tank from 'components/Tank'
import Typography from 'components/Typography'
import { IoIosArrowDown as ArrowDownIcon } from 'react-icons/io'
import { IoIosArrowUp as ArrowUpIcon } from 'react-icons/io'
import { Wrapper, Header, List } from './styles'

function TankHistoryCollapse({ tank, measurements }) {
  const [collapseIsactive, setCollapseIsactive] = useState(false)
  const { capacity, length, diameter } = tank

  //Contraer o expandir el collapse
  const toggleCollapse = () =>
    setCollapseIsactive(prevCollapse => !prevCollapse)

  return (
    <Wrapper>
      <Header>
        <Tank capacity={capacity} diameter={diameter} length={length} />
        <div>
          <Typography variant="title3" value={`Tanque ${capacity} gls`} />
          <Typography
            variant="caption"
            value={`Total: ${measurements.length} ${
              measurements.length === 1 ? 'medición' : 'mediciones'
            } `}
          />
        </div>
        {collapseIsactive ? (
          <ArrowUpIcon size={24} onClick={toggleCollapse} />
        ) : (
          <ArrowDownIcon size={24} onClick={toggleCollapse} />
        )}
      </Header>
      {collapseIsactive && (
        <List>
          {measurements &&
            measurements.length > 0 &&
            measurements.map(measurement => (
              <CardHistory
                key={measurement.id}
                measurement={measurement}
                tankCapacity={capacity}
              />
            ))}
        </List>
      )}
    </Wrapper>
  )
}

export default React.memo(TankHistoryCollapse)
