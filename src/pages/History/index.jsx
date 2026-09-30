import React, { useState, Suspense } from 'react'
import NavBar from 'components/NavBar'
import TextField from 'components/TextField'
import { format } from 'date-fns'
import DetailResultsMeasurements from 'components/DetailResultsMeasurements'
import TankHistoryCollapse from 'components/TankHistoryCollapse'
//Import icons
import { IoMdCalendar as CalendarIcon } from 'react-icons/io'
import { Wrapper, Container, NavBarContainer } from './styles'
import Typography from 'components/Typography'

import useMeasurement from 'hooks/useMeasurement'

function History() {
  const DateModal = React.lazy(() => import('components/DateModal'))
  const [calendarIsVisible, setCalendarIsVisible] = useState(false)

  //Obtenemos la lista de mediciones
  const { listOfTanks, totalGallons, onSelectDate, date } = useMeasurement()

  const showCalendar = () => setCalendarIsVisible(true)
  const hideCalendar = () => setCalendarIsVisible(false)

  return (
    <Container>
      <Wrapper>
        <TextField
          readOnly={true}
          onClick={showCalendar}
          label="Seleccione un periodo"
          value={`${format(date.start, 'dd/MM/yyyy')} al ${format(
            date.end,
            'dd/MM/yyyy'
          )} `}
          Icon={CalendarIcon}
          placeholder="Buscar tanque"
          search={true}
        />

        <DetailResultsMeasurements totalGallons={totalGallons} date={date} />

        <Typography
          mt="16px"
          variant="title2"
          value="Historial de mediciones"
        />

        {listOfTanks &&
          listOfTanks.length > 0 &&
          listOfTanks.map(tank => {
            return (
              <TankHistoryCollapse
                key={tank.tank.id}
                tank={tank.tank}
                measurements={tank.measurements}
              />
            )
          })}

        {!listOfTanks && (
          <Typography
            mt="16px"
            variant="body"
            value={`No se encontraron mediciones del ${format(
              date.start,
              'dd/MM/yyyy'
            )} al ${format(date.end, 'dd/MM/yyyy')}`}
          />
        )}
      </Wrapper>
      <NavBarContainer>
        <NavBar activeTab={1} />
      </NavBarContainer>

      {calendarIsVisible && (
        <Suspense fallback={<div>Loading...</div>}>
          <DateModal
            onSelect={dates => onSelectDate(dates)}
            closeModal={hideCalendar}
          />
        </Suspense>
      )}
    </Container>
  )
}

export default React.memo(History)
