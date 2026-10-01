import { toCsv } from 'utils/csv'
import {
  MEASUREMENT_COLUMNS,
  REFUEL_COLUMNS,
  type ExportMeasurement,
  type ExportRefuel,
} from 'utils/exportColumns'
import { exportFileName } from 'utils/exportFile'

const rowsOf = (csv: string) => csv.replace('﻿', '').split('\r\n')

test('refuel columns, in Spanish units for Excel (RF-4)', () => {
  const refuel: ExportRefuel = {
    takenAt: new Date(2026, 9, 1, 8, 5),
    userName: 'Rosa Mena',
    tankName: 'Tanque izquierdo',
    equipmentName: 'Unidad 12',
    gallonsAdded: 13.21,
    litersAdded: 50,
    currency: 'NIO',
    pricePerGallon: 113.56,
    pricePerLiter: 30,
    total: 1500,
    stationName: 'Puma Km 7',
    place: { city: 'León', state: 'León', country: 'Nicaragua' },
    odometerKm: 120600,
    gallonsBefore: 40,
    fillPercentBefore: 29.27,
    gallonsAfter: 53.21,
    fillPercentAfter: 38.91,
    hasInvoice: true,
  }
  const [header, row] = rowsOf(toCsv(REFUEL_COLUMNS, [refuel]))
  expect(header).toBe(
    'Fecha;Hora;Registrado por;Tanque;Equipo;Cantidad (gal);Cantidad (L);Moneda;Precio por galón;Precio por litro;Total;Gasolinera;Ciudad;Estado o departamento;País;Odómetro (km);Odómetro (mi);Antes (gal);Antes (L);Antes (%);Después (gal);Después (L);Después (%);Factura'
  )
  expect(row).toBe(
    '01/10/2026;08:05;Rosa Mena;Tanque izquierdo;Unidad 12;13,21;50;NIO;113,56;30;1500;Puma Km 7;León;León;Nicaragua;120600;74937;40;151,42;29,27;53,21;201,42;38,91;sí'
  )
})

test('measurement columns; what does not apply stays empty (RF-5, RF-6)', () => {
  const basic: ExportMeasurement = {
    takenAt: new Date(2026, 8, 29, 17, 30),
    userName: null,
    tankName: 'Tanque de 50 gal',
    equipmentName: null,
    inches: 12.5,
    gallons: 26.22,
    liters: 99.25,
    fillPercent: 47.5,
    estimate: null,
    odometerKm: null,
    place: null,
    placeText: 'Managua, Nicaragua',
  }
  const [header, row] = rowsOf(toCsv(MEASUREMENT_COLUMNS, [basic]))
  expect(header).toBe(
    'Fecha;Hora;Registrado por;Tanque;Equipo;Pulgadas;Galones;Litros;Llenado (%);Alcance (km);Alcance (mi);Rendimiento usado (km/gal);Odómetro (km);Odómetro (mi);Ciudad;Estado o departamento;País;Lugar'
  )
  expect(row).toBe(
    '29/09/2026;17:30;;Tanque de 50 gal;;12,5;26,22;99,25;47,5;;;;;;;;;Managua, Nicaragua'
  )
})

test('file names carry the kind, the organization and the period (RF-7)', () => {
  const period = {
    start: new Date(2026, 8, 24),
    end: new Date(2026, 9, 1, 23, 59),
  }
  expect(exportFileName('refuels', period, 'Flota de Rosa')).toBe(
    'solo-camioneros-rellenos-flota-de-rosa-2026-09-24_2026-10-01.csv'
  )
  expect(exportFileName('measurements', period, null)).toBe(
    'solo-camioneros-mediciones-2026-09-24_2026-10-01.csv'
  )
})
