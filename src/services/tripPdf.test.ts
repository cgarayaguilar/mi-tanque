import { drawTripReport } from 'services/tripPdf'
import { trip } from '../testing/fleetFixtures'
import { tripReport } from 'utils/tripReport'

// backend specs/0040 RF-7, CA-3: letter paper, landscape, numbered pages
test('many trips: several letter pages, landscape, each one numbered', () => {
  const report = tripReport({
    organization: 'Flota de Cesar',
    period: '1 oct – 31 oct 2026',
    trips: Array.from({ length: 80 }, (_, index) =>
      trip({ id: `trip-${String(index)}` })
    ),
    groups: null,
    filters: [],
    grouping: null,
    order: 'Fecha, más reciente primero',
    names: {
      client: (_, saved) => saved,
      truck: (_, saved) => saved,
      trailer: (_, saved) => saved,
      driver: (_, saved) => saved,
    },
    ownershipOf: () => ({ truck: 'own', trailer: 'own' }),
    currency: 'NIO',
    now: new Date(2026, 9, 12),
  })

  const doc = drawTripReport(report)
  const pages = doc.getNumberOfPages()

  expect(pages).toBeGreaterThan(1)
  // 11 × 8.5 in, in points
  expect(doc.internal.pageSize.getWidth()).toBeCloseTo(792)
  expect(doc.internal.pageSize.getHeight()).toBeCloseTo(612)
  const text = doc.output()
  expect(text).toContain(`Página ${String(pages)} de ${String(pages)}`)
  // "–" is the font's own sign: byte 0x96 of Windows-1252 (RF-8)
  expect(text).toContain('Managua \x96 San Jos\xe9')
})
