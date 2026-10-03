// Builds src/data/truckTanks.json from the research files (backend
// specs/0015 RF-1). Run with `npm run build:tanks` after changing them.
import { readFileSync, writeFileSync } from 'node:fs'
import process from 'node:process'
import { buildTruckTanks } from '../src/data/buildTruckTanks.ts'

const FILES = ['paccar', 'volvo-mack', 'daimler', 'navistar']
const root = new URL('../', import.meta.url)

const records = FILES.flatMap(file =>
  JSON.parse(
    readFileSync(new URL(`data/tank-research/${file}.json`, root), 'utf8')
  )
)
const { tanks, sources, discarded } = buildTruckTanks(records)

const write = (path, value) => {
  writeFileSync(new URL(path, root), `${JSON.stringify(value, null, 2)}\n`)
}
write('src/data/truckTanks.json', tanks)
write('data/tank-research/catalog-sources.json', sources)
write('data/tank-research/discarded.json', discarded)

process.stdout.write(
  `${String(records.length)} records → ${String(tanks.length)} tanks, ${String(discarded.length)} discarded\n`
)
