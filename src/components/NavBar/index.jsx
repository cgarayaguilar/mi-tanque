import React, { useState } from 'react'

import { MdHistory as HistoryIcon } from 'react-icons/md'
import { BiTachometer as MeterIcon } from 'react-icons/bi'
import { useLocation } from 'wouter'
import { Nav, NavItem } from './styles'

const Tabs = {
  HISTORY: 1,
  METER: 2,
}

export default function NavBar({ activeTab }) {
  const [tab, setTab] = useState(activeTab)
  const [_, setLocation] = useLocation()

  const handleClickTab = _tab => {
    setTab(_tab)
    _tab === Tabs.HISTORY ? setLocation('history') : setLocation('/')
  }

  /**
   * Función que realiza las validaciones para mostrar el tab correspondiente(Historial/ Medicion)
   * @param {Number} tabIndex - Número del tab a verificar
   */

  const checkActiveTab = tabIndex => {
    switch (tabIndex) {
      case Tabs.HISTORY:
        return tab === Tabs.HISTORY

      case Tabs.METER:
        return tab === Tabs.METER

      default:
        return false
    }
  }

  return (
    <Nav>
      <NavItem
        onClick={() => handleClickTab(Tabs.HISTORY)}
        active={checkActiveTab(Tabs.HISTORY)}
      >
        <HistoryIcon size={32} />
        <span>Historial</span>
      </NavItem>
      <NavItem
        onClick={() => handleClickTab(Tabs.METER)}
        active={checkActiveTab(Tabs.METER)}
      >
        <MeterIcon size={32} />
        <span>Medición</span>
      </NavItem>
    </Nav>
  )
}
