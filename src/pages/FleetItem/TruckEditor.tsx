import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useMoreDetails } from 'components/MoreDetails'
import FormSection from 'components/FormSection'
import TruckFields, { TRUCK_SECTION_DETAILS } from 'components/TruckFields'
import {
  brandAndModel,
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type Truck,
  type TruckFormValues,
} from 'schemas/fleet'
import { useFormDistanceUnit } from 'hooks/useDistanceUnit'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import { catalogFilterFor } from 'data/truckModels'
import EditorLayout from './EditorLayout'
import EquipmentTanks, { useEquipmentTanks } from './EquipmentTanks'
import { useSaveFleetItem } from './useSaveFleetItem'
import InsuranceChip from 'components/InsuranceChip'
import { insuranceNotice } from 'utils/insurance'

interface Props {
  section: FleetSection
  truck: Truck | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'truck-form'

export default function TruckEditor({
  section,
  truck,
  id,
  orgId,
  canWrite,
}: Props) {
  const members = useFleetStore(state => state.members)
  const saveItem = useSaveFleetItem(section)
  // Typed and shown in the organization's unit (backend specs/0010 RF-4)
  const unit = useFormDistanceUnit()
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    formState: { errors, isSubmitting, dirtyFields },
  } = useForm<TruckFormValues>({
    resolver: zodResolver(truckFormSchema),
    defaultValues: truckToForm(truck, unit),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  // The same notice as the fleet card (backend specs/0011 RF-5)
  const notice = truck
    ? insuranceNotice(truck.insuranceExpiresOn, new Date(), truck.archived)
    : null
  const details = useMoreDetails<TruckFormValues>(
    TRUCK_SECTION_DETAILS,
    setFocus
  )
  // Its tanks, written with it (specs/0032)
  const equipment = { kind: 'truck', id } as const
  const tanks = useEquipmentTanks(equipment, orgId)
  // Its tanks' catalog opens on this truck (specs/0016 RF-6)
  const { brand, model } = brandAndModel(values as TruckFormValues)
  const tankFilter = catalogFilterFor(
    brand,
    model,
    Number.parseInt(values.year ?? '', 10) || null
  )
  const issues = (names: readonly (keyof TruckFormValues)[]) =>
    names.filter(name => name in errors).length

  const onSubmit = (values: TruckFormValues) => {
    // A driver who left the organization: the rules refuse any edit that
    // keeps them, so the truck is left unassigned (audit 2026-10-01). Only
    // with the members loaded, or a real driver would be dropped
    const gone =
      members.length > 0 &&
      values.assignedDriverUid !== '' &&
      !members.some(member => member.uid === values.assignedDriverUid)
    const fields = truckFromForm(
      gone ? { ...values, assignedDriverUid: '' } : values,
      unit
    )
    // Untouched, they keep what is stored: shown rounded in miles, they came
    // back a kilometer off on every save (audit 2026-10-02)
    if (truck && !dirtyFields.odometer) fields.odometerKm = truck.odometerKm
    if (truck && !dirtyFields.efficiency) {
      fields.fuelEfficiencyKmPerGal = truck.fuelEfficiencyKmPerGal
    }
    if (truck && !dirtyFields.efficiencyEmpty) {
      fields.fuelEfficiencyEmptyKmPerGal = truck.fuelEfficiencyEmptyKmPerGal
    }
    saveItem(
      {
        id,
        orgId,
        archived: truck?.archived ?? false,
        photoPath: truck?.photoPath ?? null,
        ...fields,
      },
      fields,
      truck === null
    )
    // After the truck: the rules want it there first (specs/0032 RF-5)
    tanks.save()
  }

  return (
    <EditorLayout
      section={section}
      item={truck}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del camión"
        onSubmit={event => {
          void handleSubmit(onSubmit, details.onInvalid)(event)
        }}
      >
        <TruckFields
          register={register}
          control={control}
          setValue={setValue}
          errors={errors}
          values={values}
          details={details}
          unit={unit}
          members={members}
          disabled={!canWrite}
          // In sections, as the trip (specs/0032 RF-1)
          sections={({ identity, performance, more }) => (
            <Stack spacing={4}>
              <FormSection
                number={1}
                title="Datos del camión"
                hint="¿Cuál es?"
                issues={issues([
                  'name',
                  'plate',
                  'brand',
                  'model',
                  'year',
                  'colorOther',
                  'insuranceExpiresOn',
                ])}
              >
                {notice && <InsuranceChip notice={notice} />}
                {identity}
              </FormSection>
              <EquipmentTanks
                state={tanks}
                number={2}
                equipment={equipment}
                noun="camión"
                truckFilter={tankFilter}
                canWrite={canWrite}
              />
              <FormSection
                number={3}
                title="Rendimiento y odómetro"
                hint="Para estimar cuánto puedes recorrer."
                issues={issues(['efficiency', 'efficiencyEmpty', 'odometer'])}
              >
                {performance}
              </FormSection>
              {more}
            </Stack>
          )}
        />
      </Box>
    </EditorLayout>
  )
}
