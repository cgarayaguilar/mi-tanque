// Truck brands and models as people name them, and the tank catalog's models
// each one leads to by year (backend specs/0016 RF-1). A test checks that
// every model of the catalog is reachable from here, and nothing else.

export interface TruckModel {
  name: string
  /** The catalog's "Model (generation)" this truck uses, by year. */
  tanks: readonly { model: string; from?: number; to?: number }[]
}

const same = (name: string): TruckModel => ({ name, tanks: [{ model: name }] })
const as = (name: string, model: string): TruckModel => ({
  name,
  tanks: [{ model }],
})
const byYear = (
  name: string,
  generations: readonly { model: string; from?: number; to?: number }[]
): TruckModel => ({ name, tanks: generations })

const CASCADIA = [
  { model: 'Cascadia (2008–2017)', to: 2017 },
  { model: 'Cascadia (2018+)', from: 2018 },
]
const kenworthEras = (name: string) =>
  byYear(name, [
    { model: `${name} (2000–2007)`, to: 2007 },
    { model: `${name} (2008+)`, from: 2008 },
  ])

export const TRUCK_MODELS: Readonly<Record<string, readonly TruckModel[]>> = {
  Freightliner: [
    byYear('Cascadia', CASCADIA),
    same('Columbia'),
    same('Century Class'),
    same('Coronado'),
    as('Classic', 'Classic / Classic XL'),
    as('Classic XL', 'Classic / Classic XL'),
    as('FLD 112', 'FLD 112 / 120'),
    as('FLD 120', 'FLD 112 / 120'),
    same('M2 106'),
    same('M2 112'),
    same('114SD'),
  ],
  International: [
    same('LT'),
    same('LoneStar'),
    same('ProStar'),
    same('RH'),
    as('TranStar', 'TranStar / 8600'),
    as('8600', 'TranStar / 8600'),
    same('8400'),
    same('9100i'),
    same('9200i'),
    same('9400i'),
    as('9900i', '9900i / 9900ix'),
    as('9900ix', '9900i / 9900ix'),
    as('DuraStar', 'DuraStar (4100–4400)'),
    as('WorkStar', 'WorkStar (7300–7600)'),
    byYear('PayStar', [{ model: 'PayStar 5900i' }, { model: 'PayStar 5000' }]),
    same('HV'),
    same('HX'),
    same('MV'),
    as('4700', '4700 / 4800 / 4900'),
    as('4800', '4700 / 4800 / 4900'),
    as('4900', '4700 / 4800 / 4900'),
  ],
  Kenworth: [
    same('T680'),
    same('T880'),
    same('T660'),
    same('T600'),
    same('T700'),
    kenworthEras('T800'),
    kenworthEras('W900B'),
    kenworthEras('W900L'),
    same('W990'),
    same('T300'),
    same('T370'),
    same('T270'),
    same('C500'),
  ],
  Mack: [
    same('Anthem'),
    same('Pinnacle'),
    same('Vision'),
    same('CH'),
    same('Granite'),
    same('Granite CV'),
    same('Granite CT'),
    same('RD'),
    same('TerraPro'),
    same('Titan'),
    same('LR'),
  ],
  Peterbilt: [
    '579',
    '567',
    '389',
    '386',
    '384',
    '379',
    '378',
    '387',
    '367',
    '365',
    '348',
    '337',
    '330',
    '520',
  ].map(same),
  Volvo: [
    byYear('VNL', [
      { model: 'VNL (2000–2017)', to: 2017 },
      { model: 'VNL (2018–2023)', from: 2018, to: 2023 },
      { model: 'VNL (2024+)', from: 2024 },
    ]),
    byYear('VNR', [
      { model: 'VNR (2017–2023)', to: 2023 },
      { model: 'VNR (2024+)', from: 2024 },
    ]),
    same('VNM'),
    same('VHD'),
    same('VT 880'),
  ],
  'Western Star': [
    same('4900'),
    same('4800'),
    same('4700'),
    same('49X'),
    same('47X'),
    same('57X'),
    same('5700XE'),
  ],
}

export const TRUCK_BRANDS = Object.keys(TRUCK_MODELS).sort((a, b) =>
  a.localeCompare(b, 'es')
)

/** "freightliner", "FREIGHTLINER " and "Fréightliner" are the same. */
const normalize = (text: string) =>
  text
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')

/** The list's brand a typed one means, if any (RF-5). */
export const matchBrand = (typed: string | null | undefined) => {
  if (!typed) return null
  const key = normalize(typed)
  return TRUCK_BRANDS.find(brand => normalize(brand) === key) ?? null
}

/** The brand's model a typed one means, if any (RF-5). */
export const matchModel = (
  brand: string | null,
  typed: string | null | undefined
) => {
  if (!brand || !typed) return null
  const key = normalize(typed)
  return (
    TRUCK_MODELS[brand]?.find(model => normalize(model.name) === key)?.name ??
    null
  )
}

/**
 * How the tank catalog opens for this truck (RF-6): its brand, and its
 * model's generation by year. Without a year and with several generations,
 * the brand alone.
 */
export const catalogFilterFor = (
  brand: string | null | undefined,
  model: string | null | undefined,
  year: number | null | undefined
): { brand: string; model: string | null } | null => {
  const listed = matchBrand(brand)
  if (!listed) return null
  const name = matchModel(listed, model)
  const truckModel = TRUCK_MODELS[listed]?.find(item => item.name === name)
  if (!truckModel) return { brand: listed, model: null }
  const candidates =
    year === null || year === undefined
      ? truckModel.tanks
      : truckModel.tanks.filter(
          tank =>
            (tank.from === undefined || year >= tank.from) &&
            (tank.to === undefined || year <= tank.to)
        )
  return {
    brand: listed,
    model: candidates.length === 1 ? (candidates[0]?.model ?? null) : null,
  }
}
