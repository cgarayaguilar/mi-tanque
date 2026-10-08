import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import DriverFields, { DRIVER_DETAILS } from 'components/DriverFields'
import InsuranceChip from 'components/InsuranceChip'
import { useMoreDetails } from 'components/MoreDetails'
import {
  driverFormSchema,
  driverFromForm,
  driverLinkedTo,
  driverToForm,
  driverWithName,
  duplicateDriverMessage,
  type Driver,
  type DriverFormValues,
} from 'schemas/drivers'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import { licenseNotice } from 'utils/insurance'
import { ROLE_LABELS } from 'utils/roles'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  driver: Driver | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'driver-form'

/** A driver of the organization (backend specs/0023 RF-7, RF-8). */
export default function DriverEditor({
  section,
  driver,
  id,
  orgId,
  canWrite,
}: Props) {
  const drivers = useFleetStore(state => state.drivers)
  const members = useFleetStore(state => state.members)
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<DriverFormValues>({
    resolver: zodResolver(driverFormSchema),
    defaultValues: driverToForm(driver),
    disabled: !canWrite,
  })
  const values = useWatch({ control })
  const details = useMoreDetails<DriverFormValues>(DRIVER_DETAILS, setFocus)
  // The same notice as the card (RF-7)
  const notice = driver
    ? licenseNotice(driver.licenseExpiresOn, new Date(), driver.archived)
    : null

  const memberName = (uid: string) =>
    members.find(member => member.uid === uid)?.displayName ?? 'ese miembro'

  const onSubmit = (values: DriverFormValues) => {
    // The rules cannot check that these are unique: the app does (RF-8)
    const other = driverWithName(values.name, drivers, id)
    if (other) {
      setError(
        'name',
        { message: duplicateDriverMessage(other) },
        { shouldFocus: true }
      )
      return
    }
    const linked = values.memberUid
      ? driverLinkedTo(values.memberUid, drivers, id)
      : null
    if (linked) {
      setError('memberUid', {
        message: `${memberName(values.memberUid)} ya está enlazada a ${linked.name}`,
      })
      if (!details.open) details.toggle()
      return
    }
    // A member who left: the rules refuse the link, so it is dropped. Only
    // with the members loaded, or a real one would be dropped (as trucks)
    const gone =
      members.length > 0 &&
      values.memberUid !== '' &&
      !members.some(member => member.uid === values.memberUid)
    const fields = driverFromForm(gone ? { ...values, memberUid: '' } : values)
    saveItem(
      { id, orgId, archived: driver?.archived ?? false, ...fields },
      fields,
      driver === null
    )
  }

  const memberOptions = [
    { value: '', label: 'Sin cuenta' },
    ...members.map(member => ({
      value: member.uid,
      label: `${member.displayName} (${ROLE_LABELS[member.role]})`,
    })),
  ]

  return (
    <EditorLayout
      section={section}
      item={driver}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
      restoreIssue={() => {
        const linked = driver?.memberUid
          ? driverLinkedTo(driver.memberUid, drivers, id)
          : null
        return linked && driver?.memberUid
          ? `${memberName(driver.memberUid)} ya está enlazada a ${linked.name}. Quita ese enlace primero.`
          : null
      }}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del conductor"
        onSubmit={event => {
          void handleSubmit(onSubmit, details.onInvalid)(event)
        }}
      >
        <Stack spacing={5}>
          {notice && <InsuranceChip notice={notice} />}
          <DriverFields
            register={register}
            control={control}
            errors={errors}
            values={values}
            details={details}
            memberOptions={memberOptions}
            disabled={!canWrite}
          />
        </Stack>
      </Box>
    </EditorLayout>
  )
}
