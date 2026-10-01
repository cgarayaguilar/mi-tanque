import CardHistory from 'components/CardHistory'
import React, { useId, useState } from 'react'
import Tank from 'components/Tank'
import Typography from 'components/Typography'
import { IoIosArrowDown as ArrowDownIcon } from 'react-icons/io'
import { IoIosArrowUp as ArrowUpIcon } from 'react-icons/io'
import { Wrapper, Header, List } from './styles'

function TankHistoryCollapse({ tank, measurements }) {
  const [collapseIsactive, setCollapseIsactive] = useState(false)
  const { capacity, length, diameter } = tank
  const listId = useId()

  //Contraer o expandir el collapse
  const toggleCollapse = () =>
    setCollapseIsactive(prevCollapse => !prevCollapse)

  return (
    <Wrapper>
      <Header
        type="button"
        onClick={toggleCollapse}
        aria-expanded={collapseIsactive}
        aria-controls={collapseIsactive ? listId : undefined}
      >
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
          <ArrowUpIcon size={24} aria-hidden="true" />
        ) : (
          <ArrowDownIcon size={24} aria-hidden="true" />
        )}
      </Header>
      {collapseIsactive && (
        <List id={listId}>
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
