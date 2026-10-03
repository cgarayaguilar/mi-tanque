// Builds the catalog of factory truck tanks from the research files
// (backend specs/0015 RF-1–RF-6). Pure and import-free: the vitest tests and
// the Node script (scripts/build-truck-tanks.mjs) both run it.

export interface ResearchRecord {
  brand: string
  models: string[]
  years: string | null
  shape: 'cylinder' | 'd' | 'rectangular'
  diameterIn: number | null
  heightIn: number | null
  widthIn: number | null
  lengthIn: number | null
  capacityGal: number
  source: string
  sourceType: 'oem' | 'aftermarket' | 'forum'
  notes?: string | null
}

export type CatalogShape = 'cylinder' | 'd_flat_side' | 'rectangular'

export interface TruckTank {
  /** Stable, at most 40 characters (the rules' limit for templateId). */
  id: string
  brand: string
  shape: CatalogShape
  dimensions:
    | { diameterIn: number; lengthIn: number }
    | { heightIn: number; widthIn: number; lengthIn: number }
  /** Total gallons: the one the dimensions agree with. */
  capacityGal: number
  /** Useable gallons, when the source gives them apart (Peterbilt). */
  usableGal?: number
  /** "Model (generation)" of this brand that ship it. */
  models: string[]
  /** Measures that no source gave, computed (RF-3). */
  calculated?: ('length' | 'width')[]
}

export interface BuildResult {
  tanks: TruckTank[]
  sources: Record<string, string[]>
  discarded: { record: string; reason: string }[]
}

const CUBIC_INCHES_PER_GALLON = 231
/** Geometric volume over nominal capacity, when a family has no data. */
const DEFAULT_RATIO = 1.06
const FIRST_YEAR = 2000

const BRAND_CODES: Record<string, string> = {
  Freightliner: 'fl',
  'Western Star': 'ws',
  International: 'in',
  Kenworth: 'kw',
  Peterbilt: 'pb',
  Mack: 'mk',
  Volvo: 'vo',
}

/** Brands that share tanks: computed measures learn from the family. */
const FAMILIES: Record<string, string> = {
  Freightliner: 'daimler',
  'Western Star': 'daimler',
  Kenworth: 'paccar',
  Peterbilt: 'paccar',
  Volvo: 'volvo',
  Mack: 'volvo',
  International: 'navistar',
}

interface Generation {
  label: string
  from: number
  to: number
  /** Gets the records whose years are unknown. */
  byDefault?: boolean
}

interface ModelRule {
  brand: string
  raw: string[]
  model: string
  generations?: Generation[]
}

const KENWORTH_ERAS: Generation[] = [
  { label: '2000–2007', from: 2000, to: 2007 },
  { label: '2008+', from: 2008, to: Infinity, byDefault: true },
]

// One name per model, with its generation where its tanks changed (RF-5)
const MODEL_RULES: ModelRule[] = [
  { brand: 'Freightliner', raw: ['Cascadia'], model: 'Cascadia (2008–2017)' },
  { brand: 'Freightliner', raw: ['New Cascadia'], model: 'Cascadia (2018+)' },
  { brand: 'Freightliner', raw: ['Century Class'], model: 'Century Class' },
  { brand: 'Freightliner', raw: ['Columbia'], model: 'Columbia' },
  { brand: 'Freightliner', raw: ['Coronado'], model: 'Coronado' },
  {
    brand: 'Freightliner',
    raw: ['Classic/Classic XL'],
    model: 'Classic / Classic XL',
  },
  { brand: 'Freightliner', raw: ['FLD 112/120'], model: 'FLD 112 / 120' },
  { brand: 'Freightliner', raw: ['M2 106'], model: 'M2 106' },
  { brand: 'Freightliner', raw: ['M2 112'], model: 'M2 112' },
  { brand: 'Freightliner', raw: ['114SD'], model: '114SD' },
  { brand: 'Freightliner', raw: ['Argosy'], model: 'Argosy' },
  { brand: 'Western Star', raw: ['4700'], model: '4700' },
  { brand: 'Western Star', raw: ['4800'], model: '4800' },
  { brand: 'Western Star', raw: ['4900'], model: '4900' },
  { brand: 'Western Star', raw: ['47X'], model: '47X' },
  { brand: 'Western Star', raw: ['49X'], model: '49X' },
  { brand: 'Western Star', raw: ['57X'], model: '57X' },
  { brand: 'Western Star', raw: ['5700'], model: '5700XE' },
  {
    brand: 'International',
    raw: ['4100', '4200', '4300', '4400', 'DuraStar', 'DuraStar 4300/4400'],
    model: 'DuraStar (4100–4400)',
  },
  {
    brand: 'International',
    raw: ['4700', '4800', '4900'],
    model: '4700 / 4800 / 4900',
  },
  {
    brand: 'International',
    raw: ['7600', 'WorkStar', 'WorkStar 7300-7600'],
    model: 'WorkStar (7300–7600)',
  },
  { brand: 'International', raw: ['8400'], model: '8400' },
  {
    brand: 'International',
    raw: ['8600', 'TranStar'],
    model: 'TranStar / 8600',
  },
  { brand: 'International', raw: ['9100i'], model: '9100i' },
  { brand: 'International', raw: ['9200', '9200i'], model: '9200i' },
  { brand: 'International', raw: ['9400', '9400i'], model: '9400i' },
  {
    brand: 'International',
    raw: ['9900i', '9900ix'],
    model: '9900i / 9900ix',
  },
  { brand: 'International', raw: ['HV'], model: 'HV' },
  { brand: 'International', raw: ['HX'], model: 'HX' },
  { brand: 'International', raw: ['MV'], model: 'MV' },
  { brand: 'International', raw: ['LT'], model: 'LT' },
  { brand: 'International', raw: ['LoneStar'], model: 'LoneStar' },
  { brand: 'International', raw: ['ProStar'], model: 'ProStar' },
  { brand: 'International', raw: ['RH'], model: 'RH' },
  { brand: 'International', raw: ['PayStar 5000'], model: 'PayStar 5000' },
  { brand: 'International', raw: ['PayStar 5900i'], model: 'PayStar 5900i' },
  { brand: 'Kenworth', raw: ['C500'], model: 'C500' },
  { brand: 'Kenworth', raw: ['T270'], model: 'T270' },
  { brand: 'Kenworth', raw: ['T300'], model: 'T300' },
  { brand: 'Kenworth', raw: ['T370'], model: 'T370' },
  { brand: 'Kenworth', raw: ['T600'], model: 'T600' },
  { brand: 'Kenworth', raw: ['T660'], model: 'T660' },
  { brand: 'Kenworth', raw: ['T680'], model: 'T680' },
  { brand: 'Kenworth', raw: ['T700'], model: 'T700' },
  { brand: 'Kenworth', raw: ['T880'], model: 'T880' },
  { brand: 'Kenworth', raw: ['W990'], model: 'W990' },
  {
    brand: 'Kenworth',
    raw: ['T800'],
    model: 'T800',
    generations: KENWORTH_ERAS,
  },
  {
    brand: 'Kenworth',
    raw: ['W900B'],
    model: 'W900B',
    generations: KENWORTH_ERAS,
  },
  {
    brand: 'Kenworth',
    raw: ['W900L'],
    model: 'W900L',
    generations: KENWORTH_ERAS,
  },
  ...[
    '330',
    '337',
    '348',
    '365',
    '367',
    '378',
    '379',
    '384',
    '386',
    '387',
    '389',
    '520',
    '567',
    '579',
  ].map(model => ({ brand: 'Peterbilt', raw: [model], model })),
  { brand: 'Mack', raw: ['Anthem'], model: 'Anthem' },
  { brand: 'Mack', raw: ['CH (CH612/CH613)'], model: 'CH' },
  {
    brand: 'Mack',
    raw: ['CHN (Vision axle-fwd)', 'Vision CX (CX612/CX613)'],
    model: 'Vision',
  },
  {
    brand: 'Mack',
    raw: [
      'CHN613',
      'CHU613',
      'Pinnacle (CXU/CHU)',
      'Pinnacle CHU',
      'Pinnacle CXU',
    ],
    model: 'Pinnacle',
  },
  {
    brand: 'Mack',
    raw: ['Granite', 'Granite (GU)', 'Granite GU'],
    model: 'Granite',
  },
  {
    brand: 'Mack',
    raw: ['Granite CV (CV712/CV713)', 'Granite CV713'],
    model: 'Granite CV',
  },
  { brand: 'Mack', raw: ['Granite CT (CT713)'], model: 'Granite CT' },
  { brand: 'Mack', raw: ['Granite MHD'], model: 'Granite MHD' },
  { brand: 'Mack', raw: ['LR'], model: 'LR' },
  { brand: 'Mack', raw: ['RD (RD688/RD690)'], model: 'RD' },
  { brand: 'Mack', raw: ['TerraPro (MRU)'], model: 'TerraPro' },
  { brand: 'Mack', raw: ['Titan (TD)'], model: 'Titan' },
  {
    brand: 'Volvo',
    raw: [
      'VNL',
      'VNL (Gen I)',
      'VNL (Gen II)',
      'VNL (Gen III)',
      'VNL 300',
      'VNL 430',
      'VNL 440',
      'VNL 630',
      'VNL 640',
      'VNL 660',
      'VNL 670',
      'VNL 730',
      'VNL 780',
      'VNL 840',
      'VNL 860',
    ],
    model: 'VNL',
    generations: [
      { label: '2000–2017', from: 2000, to: 2017, byDefault: true },
      { label: '2018–2023', from: 2018, to: 2023 },
      { label: '2024+', from: 2024, to: Infinity },
    ],
  },
  {
    brand: 'Volvo',
    raw: ['VNR', 'VNR 300', 'VNR 440', 'VNR 640'],
    model: 'VNR',
    generations: [
      { label: '2017–2023', from: 2017, to: 2023, byDefault: true },
      { label: '2024+', from: 2024, to: Infinity },
    ],
  },
  { brand: 'Volvo', raw: ['VNM'], model: 'VNM' },
  { brand: 'Volvo', raw: ['VHD'], model: 'VHD' },
  { brand: 'Volvo', raw: ['VT880'], model: 'VT 880' },
]

/** First and last year a record covers; open ranges go on forever. */
export const parseYears = (
  years: string | null
): { from: number; to: number } | null => {
  if (years === null || years.trim() === '') return null
  // Years only: model numbers like 8600 or 4700 are not years
  const numbers = (years.match(/\b(?:19|20)\d{2}\b/g) ?? []).map(Number)
  if (numbers.length === 0) return null
  const open = /present|\+|-\s*$|-\s*;/i.test(years)
  return {
    from: Math.min(...numbers),
    to: open ? Infinity : Math.max(...numbers),
  }
}

/** The catalog's model names for a record's raw model, in its years. */
export const modelNames = (
  brand: string,
  raw: string,
  years: string | null
): string[] => {
  const rule = MODEL_RULES.find(
    item => item.brand === brand && item.raw.includes(raw)
  )
  if (!rule) throw new Error(`No model rule for ${brand} "${raw}"`)
  const span = parseYears(years)
  // Out of scope: trucks from before 2000 (owner, 2026-10-02)
  if (span && span.to < FIRST_YEAR) return []
  if (!rule.generations) return [rule.model]
  const generations = span
    ? rule.generations.filter(gen => gen.from <= span.to && gen.to >= span.from)
    : rule.generations.filter(gen => gen.byDefault === true)
  return generations.map(gen => `${rule.model} (${gen.label})`)
}

const round1 = (value: number) => Math.round(value * 10) / 10

const circleArea = (diameter: number) => Math.PI * (diameter / 2) ** 2

/** Cross-section of a "D" with its flat side up against the chassis. */
const dArea = (height: number, width: number) => {
  const radius = height / 2
  return (width - radius) * height + (Math.PI * radius ** 2) / 2
}

interface Draft {
  record: ResearchRecord
  label: string
  brand: string
  shape: CatalogShape
  size: number
  width: number | null
  length: number | null
  capacity: number
  usable: number | null
  models: string[]
  sources: string[]
  oem: boolean
  calculated: ('length' | 'width')[]
}

const labelOf = (record: ResearchRecord) =>
  `${record.brand} ${record.models.join('/') || '(sin modelo)'} · ${record.shape} ${String(record.diameterIn ?? record.heightIn)}×${String(record.lengthIn)} · ${String(record.capacityGal)} gal`

const SNIPPET = /snippet only|search snippet|low confidence|title only/i
const APPROXIMATE_CAPACITY = /approx\.? \d+ gal/i

/** The total capacity, when the source gives useable and total apart. */
const capacities = (record: ResearchRecord) => {
  const split = /(\d+(?:\.\d+)?) useable \/ (\d+(?:\.\d+)?) total/i.exec(
    record.notes ?? ''
  )
  return split
    ? { capacity: Number(split[2]), usable: Number(split[1]) }
    : { capacity: record.capacityGal, usable: null }
}

const geometricGallons = (draft: {
  shape: CatalogShape
  size: number
  width: number | null
  length: number | null
}) => {
  if (draft.length === null) return null
  const area =
    draft.shape === 'cylinder'
      ? circleArea(draft.size)
      : draft.width === null
        ? null
        : draft.shape === 'd_flat_side'
          ? dArea(draft.size, draft.width)
          : draft.size * draft.width
  return area === null ? null : (area * draft.length) / CUBIC_INCHES_PER_GALLON
}

/** Least squares length = a·gallons + b, from tanks of one diameter. */
const fitLength = (points: { capacity: number; length: number }[]) => {
  const n = points.length
  const meanX = points.reduce((sum, p) => sum + p.capacity, 0) / n
  const meanY = points.reduce((sum, p) => sum + p.length, 0) / n
  const sxx = points.reduce((sum, p) => sum + (p.capacity - meanX) ** 2, 0)
  const sxy = points.reduce(
    (sum, p) => sum + (p.capacity - meanX) * (p.length - meanY),
    0
  )
  const slope = sxx === 0 ? 0 : sxy / sxx
  return (capacity: number) => meanY + slope * (capacity - meanX)
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b)
  return sorted.length === 0
    ? DEFAULT_RATIO
    : (sorted[Math.floor(sorted.length / 2)] ?? DEFAULT_RATIO)
}

const format = (value: number) => String(round1(value)).replace(/\.0$/, '')

export const buildTruckTanks = (records: ResearchRecord[]): BuildResult => {
  // Every tank says where it comes from (RNF-3)
  for (const record of records) {
    if (!/^https?:\/\//.test(record.source))
      throw new Error(`A record without a source: ${labelOf(record)}`)
  }
  const discarded: BuildResult['discarded'] = []
  const discard = (record: ResearchRecord, reason: string) => {
    discarded.push({ record: labelOf(record), reason })
  }

  // 1. Usable records, with their total capacity and the catalog's names
  const drafts: Draft[] = []
  for (const record of records) {
    if (record.models.length === 0) {
      discard(record, 'sin modelo')
      continue
    }
    if (SNIPPET.test(record.notes ?? '')) {
      discard(record, 'solo el texto de un buscador o de un título')
      continue
    }
    if (APPROXIMATE_CAPACITY.test(record.notes ?? '')) {
      discard(record, 'capacidad aproximada')
      continue
    }
    const shape: CatalogShape =
      record.shape === 'cylinder'
        ? 'cylinder'
        : record.shape === 'd'
          ? 'd_flat_side'
          : 'rectangular'
    const size = shape === 'cylinder' ? record.diameterIn : record.heightIn
    if (size === null) {
      discard(record, 'falta el diámetro o el alto')
      continue
    }
    if (
      shape === 'rectangular' &&
      (record.widthIn === null || record.lengthIn === null)
    ) {
      discard(record, 'rectangular sin sección completa')
      continue
    }
    const models = [
      ...new Set(
        record.models.flatMap(raw =>
          modelNames(record.brand, raw, record.years)
        )
      ),
    ]
    if (models.length === 0) {
      discard(record, 'camiones anteriores al 2000')
      continue
    }
    const { capacity, usable } = capacities(record)
    drafts.push({
      record,
      label: labelOf(record),
      brand: record.brand,
      shape,
      size,
      width: record.widthIn,
      length: record.lengthIn,
      capacity,
      usable,
      models,
      sources: [record.source],
      oem: record.sourceType === 'oem',
      calculated: [],
    })
  }

  // 2. Geometric over nominal, per family, from complete cylinders
  const ratios = new Map<string, number[]>()
  for (const draft of drafts) {
    const gallons = draft.shape === 'cylinder' ? geometricGallons(draft) : null
    if (gallons === null) continue
    const family = FAMILIES[draft.brand] ?? draft.brand
    ratios.set(family, [
      ...(ratios.get(family) ?? []),
      gallons / draft.capacity,
    ])
  }
  const ratioOf = (brand: string) =>
    median(ratios.get(FAMILIES[brand] ?? brand) ?? [])

  // 3. Same tank twice: one entry, the factory's length first (RF-2)
  const sameTank = (a: Draft, b: Draft) =>
    a.brand === b.brand &&
    a.shape === b.shape &&
    a.size === b.size &&
    a.capacity === b.capacity &&
    (a.width === null ||
      b.width === null ||
      Math.abs(a.width - b.width) <= 1) &&
    (a.length === null ||
      b.length === null ||
      Math.abs(a.length - b.length) <= 2)
  const ordered = [...drafts].sort(
    (a, b) =>
      Number(b.oem) - Number(a.oem) ||
      Number(b.length !== null) - Number(a.length !== null)
  )
  const merged: Draft[] = []
  for (const draft of ordered) {
    const into = merged.find(item => sameTank(item, draft))
    if (!into) {
      merged.push({ ...draft, models: [...draft.models] })
      continue
    }
    into.models = [...new Set([...into.models, ...draft.models])]
    into.sources = [...new Set([...into.sources, ...draft.sources])]
    into.width ??= draft.width
    into.length ??= draft.length
    into.usable ??= draft.usable
  }

  // 4. Measures no source gave (RF-3)
  const tanks: TruckTank[] = []
  const sources: Record<string, string[]> = {}
  for (const draft of merged) {
    if (draft.length === null) {
      const family = FAMILIES[draft.brand] ?? draft.brand
      const sameSize = merged.filter(
        item =>
          item.length !== null &&
          item.shape === draft.shape &&
          item.size === draft.size &&
          (FAMILIES[item.brand] ?? item.brand) === family &&
          item.calculated.length === 0
      )
      const factory = sameSize.filter(item => item.oem)
      const points = (factory.length >= 2 ? factory : sameSize).map(item => ({
        capacity: item.capacity,
        length: item.length ?? 0,
      }))
      if (points.length >= 2) {
        draft.length = round1(fitLength(points)(draft.capacity))
      } else if (draft.shape === 'cylinder') {
        draft.length = round1(
          (draft.capacity * CUBIC_INCHES_PER_GALLON * ratioOf(draft.brand)) /
            circleArea(draft.size)
        )
      } else {
        discard(
          draft.record,
          'sin largo y sin tanques parecidos para calcularlo'
        )
        continue
      }
      draft.calculated.push('length')
    }
    if (draft.shape === 'd_flat_side' && draft.width === null) {
      const area =
        (draft.capacity * CUBIC_INCHES_PER_GALLON * ratioOf(draft.brand)) /
        draft.length
      const radius = draft.size / 2
      const width = round1(
        radius + (area - (Math.PI * radius ** 2) / 2) / draft.size
      )
      if (width < draft.size / 2 || width > draft.size * 1.5) {
        discard(
          draft.record,
          `ancho calculado fuera de lo razonable (${format(width)} pulg.)`
        )
        continue
      }
      draft.width = width
      draft.calculated.push('width')
    }
    // A capacity the measures cannot hold, or far too small for them
    const gallons = geometricGallons(draft)
    const ratio = gallons === null ? null : gallons / draft.capacity
    if (ratio !== null && (ratio < 0.9 || ratio > 1.3)) {
      discard(
        draft.record,
        `la capacidad no cuadra con las medidas (${ratio.toFixed(2)})`
      )
      continue
    }

    const length = draft.length
    const shapeCode =
      draft.shape === 'cylinder'
        ? 'c'
        : draft.shape === 'd_flat_side'
          ? 'd'
          : 'r'
    const size =
      draft.shape === 'cylinder'
        ? format(draft.size)
        : `${format(draft.size)}x${format(draft.width ?? 0)}`
    const base = `${BRAND_CODES[draft.brand] ?? 'xx'}-${shapeCode}${size}x${format(length)}-${format(draft.capacity)}`
    let id = base
    for (let n = 2; id in sources; n += 1) id = `${base}~${String(n)}`
    if (id.length > 40) throw new Error(`Id too long: ${id}`)

    sources[id] = draft.sources
    tanks.push({
      id,
      brand: draft.brand,
      shape: draft.shape,
      dimensions:
        draft.shape === 'cylinder'
          ? { diameterIn: draft.size, lengthIn: length }
          : {
              heightIn: draft.size,
              widthIn: draft.width ?? 0,
              lengthIn: length,
            },
      capacityGal: draft.capacity,
      ...(draft.usable === null ? {} : { usableGal: draft.usable }),
      models: [...draft.models].sort((a, b) =>
        a.localeCompare(b, 'es', { numeric: true })
      ),
      ...(draft.calculated.length > 0 ? { calculated: draft.calculated } : {}),
    })
  }

  tanks.sort(
    (a, b) =>
      a.brand.localeCompare(b.brand) ||
      a.capacityGal - b.capacityGal ||
      a.id.localeCompare(b.id)
  )
  return { tanks, sources, discarded }
}
