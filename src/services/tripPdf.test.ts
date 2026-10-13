import { drawTripReport } from 'services/tripPdf'
import { trip } from '../testing/fleetFixtures'
import { tripReport, type TripReportKind } from 'utils/tripReport'

const reportOf = (kind: TripReportKind) =>
  tripReport({
    kind,
    organization: 'Flota de Cesar',
    period: '1 oct – 31 oct 2026',
    trips: Array.from({ length: 80 }, (_, index) =>
      trip({ id: `trip-${String(index)}`, currency: 'CRC' })
    ),
    groups: null,
    filters: [],
    client: null,
    grouping: null,
    order: 'Fecha, más reciente primero',
    names: {
      client: (_, saved) => saved,
      truck: (_, saved) => saved,
      trailer: (_, saved) => saved,
      driver: (_, saved) => saved,
    },
    plates: { truck: (_, saved) => saved, trailer: (_, saved) => saved },
    ownershipOf: () => ({ truck: 'own', trailer: 'own' }),
    currency: 'CRC',
    now: new Date(2026, 9, 12),
  })

// backend specs/0040 RF-7, 0041 RF-8: letter paper, landscape, numbered
// pages, in the app's font
test.each<TripReportKind>(['internal', 'client'])(
  'many trips (%s): several letter pages, landscape, in Inter',
  kind => {
    const doc = drawTripReport(reportOf(kind))

    expect(doc.getNumberOfPages()).toBeGreaterThan(1)
    // 11 × 8.5 in, in points
    expect(doc.internal.pageSize.getWidth()).toBeCloseTo(792)
    expect(doc.internal.pageSize.getHeight()).toBeCloseTo(612)
    // The colón's sign needs it: Helvetica has no "₡"
    expect(doc.getFontList()).toHaveProperty('Inter')
    expect(doc.output()).toContain('/FontFile2')
  }
)
