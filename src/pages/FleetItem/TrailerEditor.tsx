import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import { useMoreDetails } from 'components/MoreDetails'
import TrailerFields, { TRAILER_DETAILS } from 'components/TrailerFields'
import {
  trailerFormSchema,
  trailerFromForm,
  trailerToForm,
  type Trailer,
  type TrailerFormValues,
} from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import { useCreateDialogs } from 'components/CreateDialogs'
import FormSection from 'components/FormSection'
import EditorLayout from './EditorLayout'
import EquipmentTanks, { useEquipmentTanks } from './EquipmentTanks'
import { useSaveFleetItem } from './useSaveFleetItem'
import InsuranceChip from 'components/InsuranceChip'
import { insuranceNotice } from 'utils/insurance'

interface Props {
  section: FleetSection
  trailer: Trailer | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'trailer-form'

export default function TrailerEditor({
  section,
  trailer,
  id,
  orgId,
  canWrite,
}: Props) {
  const trucks = useFleetStore(state => state.trucks)
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<TrailerFormValues>({
    resolver: zodResolver(trailerFormSchema),
    defaultValues: trailerToForm(trailer),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  // The same notice as the fleet card (backend specs/0011 RF-5)
  const notice = trailer
    ? insuranceNotice(trailer.insuranceExpiresOn, new Date(), trailer.archived)
    : null
  const details = useMoreDetails<TrailerFormValues>(TRAILER_DETAILS, setFocus)
  // "+ Crear camión" in "Enganchado a" (specs/0031 RF-2)
  const { create, dialog } = useCreateDialogs(orgId)
  // Its tanks, written with it (specs/0032)
  const equipment = { kind: 'trailer', id } as const
  const tanks = useEquipmentTanks(equipment, orgId)

  const onSubmit = (values: TrailerFormValues) => {
    const fields = trailerFromForm(values)
    saveItem(
      {
        id,
        orgId,
        archived: trailer?.archived ?? false,
        photoPath: trailer?.photoPath ?? null,
        ...fields,
      },
      fields,
      trailer === null
    )
    // After the trailer: the rules want it there first (specs/0032 RF-5)
    tanks.save()
  }

  // Archived trucks are not offered, unless this trailer is still hitched to one
  const truckOptions = [
    { value: '', label: 'Sin enganchar' },
    ...trucks
      .filter(truck => !truck.archived || truck.id === trailer?.hitchedTruckId)
      .map(truck => ({ value: truck.id, label: truck.name })),
  ]

  return (
    <EditorLayout
      section={section}
      item={trailer}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del remolque"
        onSubmit={event => {
          void handleSubmit(onSubmit, details.onInvalid)(event)
        }}
      >
        <TrailerFields
          register={register}
          control={control}
          errors={errors}
          values={values}
          details={details}
          truckOptions={truckOptions}
          disabled={!canWrite}
          createTruck={{
            label: 'Crear camión',
            onCreate: text => {
              create('truck', text, truckId => {
                setValue('hitchedTruckId', truckId)
              })
            },
          }}
          // In sections, as the trip (specs/0032 RF-2)
          sections={({ identity, more }) => (
            <Stack spacing={4}>
              <FormSection
                number={1}
                title="Datos del remolque"
                hint="¿Cuál es?"
                issues={
                  Object.keys(errors).filter(
                    name =>
                      !(TRAILER_DETAILS as readonly string[]).includes(name)
                  ).length
                }
              >
                {notice && <InsuranceChip notice={notice} />}
                {identity}
              </FormSection>
              <EquipmentTanks
                state={tanks}
                number={2}
                equipment={equipment}
                noun="remolque"
                truckFilter={null}
                canWrite={canWrite}
              />
              {more}
            </Stack>
          )}
        />
      </Box>
      {dialog}
    </EditorLayout>
  )
}
