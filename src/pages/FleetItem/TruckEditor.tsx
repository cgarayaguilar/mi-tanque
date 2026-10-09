import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useMoreDetails } from 'components/MoreDetails'
import TruckFields, { TRUCK_DETAILS } from 'components/TruckFields'
import {
  truckFormSchema,
  truckFromForm,
  truckToForm,
  type Truck,
  type TruckFormValues,
} from 'schemas/fleet'
import { useFormDistanceUnit } from 'hooks/useDistanceUnit'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import EditorLayout from './EditorLayout'
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
  const details = useMoreDetails<TruckFormValues>(TRUCK_DETAILS, setFocus)

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
        <Stack spacing={5}>
          {notice && <InsuranceChip notice={notice} />}
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
          />
        </Stack>
      </Box>
    </EditorLayout>
  )
}
