import { useState } from 'react'
import { useLocation } from 'wouter'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import FormSection from 'components/FormSection'
import TankShapeIcon from 'components/TankShapeIcon'
import type { TankFormFields } from 'components/TankForm'
import { useCreateFleetItem } from 'hooks/useCreateFleetItem'
import type { FleetTank, TankEquipment } from 'schemas/fleet'
import { newFleetId } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { TANKS_PER_EQUIPMENT, tankCardLines } from 'utils/equipmentTanks'
import { sectionBySlug } from 'utils/fleetSections'
import RowCard from 'components/RowCard'
import TankDialog from './TankDialog'

const TANKS = sectionBySlug('tanques')
const NO_EQUIPMENT: TankEquipment = { kind: 'none', id: null }

interface TankRow {
  tank: FleetTank
  /** What its dialog wrote; null while untouched. */
  fields: TankFormFields | null
  isNew: boolean
  /** As it is saved: what stays if it is taken out (audit 2026-10-09). */
  saved: FleetTank | null
}

/**
 * The tanks of a truck or a trailer in its form (backend specs/0032): they
 * change here and are written with it, after it.
 */
export const useEquipmentTanks = (equipment: TankEquipment, orgId: string) => {
  const saveTank = useCreateFleetItem(TANKS)
  const [rows, setRows] = useState<TankRow[]>(() =>
    useFleetStore
      .getState()
      .tanks.filter(
        tank =>
          !tank.archived &&
          tank.equipment.kind === equipment.kind &&
          tank.equipment.id === equipment.id
      )
      .map(tank => ({ tank, fields: null, isNew: false, saved: tank }))
  )
  // Saved ones taken out: left as loose tanks when the equipment is saved
  const [removed, setRemoved] = useState<FleetTank[]>([])

  const put = (fields: TankFormFields, index: number | null) => {
    const old = index === null ? undefined : rows[index]
    // Its id exists from the moment it is added (ADR 0003)
    const tank: FleetTank = {
      id: old?.tank.id ?? newFleetId(),
      orgId,
      archived: false,
      photoPath: old?.tank.photoPath ?? null,
      lastMeasurement: old?.tank.lastMeasurement ?? null,
      ...fields,
    }
    const row = {
      tank,
      fields,
      isNew: old?.isNew ?? true,
      saved: old?.saved ?? null,
    }
    setRows(
      index === null
        ? [...rows, row]
        : rows.map((item, at) => (at === index ? row : item))
    )
  }

  const remove = (index: number) => {
    const row = rows[index]
    if (!row) return
    // Its edits here are dropped: only its equipment changes
    if (!row.isNew) setRemoved(current => [...current, row.saved ?? row.tank])
    setRows(current => current.filter((_, at) => at !== index))
  }

  /** After the equipment's own write: its tanks, in order, quietly. */
  const save = () => {
    for (const row of rows) {
      if (!row.fields) continue
      saveTank(row.tank, row.fields, row.isNew, true)
    }
    for (const tank of removed) {
      saveTank(
        { ...tank, equipment: NO_EQUIPMENT },
        { equipment: NO_EQUIPMENT },
        false,
        true
      )
    }
  }

  return { rows, put, remove, save }
}

export type EquipmentTanksState = ReturnType<typeof useEquipmentTanks>

interface EquipmentTanksProps {
  state: EquipmentTanksState
  number: number
  equipment: TankEquipment
  /** "camión" or "remolque", for its texts. */
  noun: 'camión' | 'remolque'
  truckFilter: { brand: string; model: string | null } | null
  canWrite: boolean
}

/** "Tanques" of a truck or a trailer: cards, and a dialog for each. */
export default function EquipmentTanks({
  state,
  number,
  equipment,
  noun,
  truckFilter,
  canWrite,
}: EquipmentTanksProps) {
  const [, navigate] = useLocation()
  // The tank open in its dialog; index null is a new one
  const [open, setOpen] = useState<{ index: number | null } | null>(null)
  const full = state.rows.length >= TANKS_PER_EQUIPMENT
  const openRow =
    open === null || open.index === null ? null : state.rows[open.index]

  return (
    <FormSection
      number={number}
      title="Tanques"
      hint="Donde mides el combustible."
      {...(canWrite &&
        !full && {
          action: (
            <Button
              startIcon={<AddIcon />}
              aria-label="Agregar tanque"
              onClick={() => {
                setOpen({ index: null })
              }}
            >
              Agregar
            </Button>
          ),
        })}
    >
      {state.rows.length === 0 ? (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          Aún no tiene tanques. Agrega uno para poder medirlo.
        </Typography>
      ) : (
        <Stack
          component="ul"
          aria-label={`Tanques del ${noun}`}
          spacing={2}
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {state.rows.map(({ tank, isNew }, index) => (
            <RowCard
              key={tank.id}
              label={`Tanque ${tank.name}`}
              title={tank.name}
              lines={tankCardLines(tank)}
              leading={<TankShapeIcon shape={tank.shape} size={36} />}
              onClick={() => {
                // Read only: its own screen (RF-7)
                if (canWrite) setOpen({ index })
                else navigate(`/flota/tanques/${tank.id}`)
              }}
              {...(canWrite && {
                removal: {
                  menuLabel: `Opciones del tanque ${tank.name}`,
                  title: `¿Quitar este tanque del ${noun}?`,
                  description: isNew
                    ? `Aún no está guardado: no se guardará con el ${noun}.`
                    : `Queda como tanque individual, con su historial, al guardar el ${noun}.`,
                  onRemove: () => {
                    state.remove(index)
                  },
                },
              })}
            />
          ))}
        </Stack>
      )}
      {full && canWrite && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          Un {noun} lleva hasta {TANKS_PER_EQUIPMENT} tanques.
        </Typography>
      )}
      {open && (
        <TankDialog
          tank={openRow?.tank ?? null}
          equipment={equipment}
          truckFilter={truckFilter}
          onSave={fields => {
            state.put(fields, open.index)
          }}
          onClose={() => {
            setOpen(null)
          }}
        />
      )}
    </FormSection>
  )
}
