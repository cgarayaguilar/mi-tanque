import React from 'react'
import { useState } from 'react'
import Modal from 'components/Modal'
import { DateRange, Buttons, Calendar } from './styles'
import Button from 'components/Button'
import 'react-date-range/dist/styles.css' // main css file
import 'react-date-range/dist/theme/default.css' // theme

function DateModal({ closeModal, onSelect }) {
  const [state, setState] = useState([
    {
      startDate: new Date(),
      endDate: null,
      key: 'selection',
    },
  ])

  const handleChange = item => {
    setState([item.selection])
  }

  const handleClick = () => {
    /* const dates = {
      startDate: format(state[0].startDate, 'YYYY-MM-DD'),
      endDate: format(state[0].endDate, 'YYYY-MM-DD'),
    }*/

    const dates = {
      startDate: state[0].startDate,
      endDate: state[0].endDate,
    }

    onSelect(dates)
    closeModal()
  }

  return (
    <Modal closeModal={closeModal}>
      <Calendar>
        <Buttons>
          <Button size="large" variant="filled" onClick={handleClick}>
            Seleccionar
          </Button>
        </Buttons>
        <DateRange
          rangeColors={['#00A8CC']}
          color="#00A8CC"
          onChange={handleChange}
          showMonthArrow={false}
          editableDateInputs={true}
          moveRangeOnFirstSelection={false}
          ranges={state}
          scroll={{ enabled: true, calendarHeight: 500 }}
          minDate={new Date('01/06/2020')}
          maxDate={new Date()}
        />
      </Calendar>
    </Modal>
  )
}

export default React.memo(DateModal)
