import { useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AutocompleteField from 'components/AutocompleteField'
import ChoiceButtons, { ChoiceButtonsBase } from 'components/ChoiceButtons'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TankShapeIcon from 'components/TankShapeIcon'
import TextField from 'components/TextField'
import {
  TANK_ORIENTATION_LABELS,
  TANK_SHAPE_LABELS,
  tankFormSchema,
  tankFromForm,
  tankGeometryFromForm,
  tankToForm,
  type FleetTank,
  type TankFormValues,
} from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import { radius } from 'theme/tokens'
import type { FleetSection } from 'utils/fleetSections'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { TANK_TEMPLATES } from 'utils/tankTemplates'
import {
  fullVolumeGallons,
  TANK_ORIENTATIONS,
  TANK_SHAPES,
  type TankGeometry,
} from 'utils/tankVolume'
import EditorLayout from './EditorLayout'
import { useSaveFleetItem } from './useSaveFleetItem'

interface Props {
  section: FleetSection
  tank: FleetTank | null
  id: string
  orgId: string
  canWrite: boolean
}

const FORM_ID = 'tank-form'

const summaryBox = {
  display: 'flex',
  alignItems: 'center',
  gap: 4,
  p: 4,
  bgcolor: 'background.paper',
  border: 1,
  borderColor: 'divider',
  borderRadius: `${String(radius.lg)}px`,
} as const

// A capacity this far from the geometry suggests a measuring mistake (RF-10)
const CAPACITY_TOLERANCE = 0.15

/** The geometry if every measurement the shape needs is a positive number. */
const geometryOf = (values: TankFormValues): TankGeometry | null => {
  const geometry = tankGeometryFromForm(values)
  const numbers = Object.values(geometry.dimensions)
  return numbers.every(value => Number.isFinite(value) && value > 0)
    ? geometry
    : null
}

type Describe = 'template' | 'measures'

/** The model these values still are, if any. */
const templateOf = (values: TankFormValues) => {
  const template = TANK_TEMPLATES.find(item => item.id === values.templateId)
  return template !== undefined &&
    values.shape === 'cylinder' &&
    values.orientation === 'horizontal' &&
    parseDecimal(values.diameter) === template.diameterIn &&
    parseDecimal(values.length) === template.lengthIn
    ? template
    : null
}

export default function TankEditor({
  section,
  tank,
  id,
  orgId,
  canWrite,
}: Props) {
  const trucks = useFleetStore(state => state.trucks)
  const trailers = useFleetStore(state => state.trailers)
  const saveItem = useSaveFleetItem(section)
  const {
    register,
    handleSubmit,
    control,
    setValue,
    setError,
    setFocus,
    formState: { errors, isSubmitting },
  } = useForm<TankFormValues>({
    resolver: zodResolver(tankFormSchema),
    defaultValues: tankToForm(tank),
    disabled: !canWrite,
  })
  const values = useWatch({ control }) as TankFormValues
  // How the tank is described (RF-9): a new one starts from a model; an
  // existing one opens the way it is
  const [describe, setDescribe] = useState<Describe>(() =>
    tank === null || templateOf(tankToForm(tank)) ? 'template' : 'measures'
  )
  const template = TANK_TEMPLATES.find(item => item.id === values.templateId)
  const details = useMoreDetails<TankFormValues>(['description'], setFocus)
  const geometry = geometryOf(values)
  const volume = geometry ? fullVolumeGallons(geometry) : null
  const capacity = parseDecimal(values.capacity)
  const capacityLooksOff =
    volume !== null &&
    Number.isFinite(capacity) &&
    Math.abs(capacity - volume) / volume > CAPACITY_TOLERANCE

  const applyTemplate = (templateId: string) => {
    const template = TANK_TEMPLATES.find(item => item.id === templateId)
    if (!template) return
    setValue('shape', 'cylinder')
    setValue('orientation', 'horizontal')
    setValue('diameter', formatNumber(template.diameterIn))
    setValue('length', formatNumber(template.lengthIn))
    setValue('capacity', formatNumber(template.capacityGal))
  }

  const onSubmit = (formValues: TankFormValues) => {
    const fields = tankFromForm(formValues)
    // A template stays linked only while the tank still is that template
    if (!templateOf(formValues)) fields.templateId = null
    saveItem(
      {
        id,
        orgId,
        archived: tank?.archived ?? false,
        photoPath: tank?.photoPath ?? null,
        lastMeasurement: tank?.lastMeasurement ?? null,
        ...fields,
      },
      fields,
      tank === null
    )
  }

  const isCurrent = (kind: string, itemId: string) =>
    tank?.equipment.kind === kind && tank.equipment.id === itemId
  const equipmentOptions = [
    { value: 'none', label: 'Tanque individual (sin equipo)' },
    ...trucks
      .filter(truck => !truck.archived || isCurrent('truck', truck.id))
      .map(truck => ({
        value: `truck:${truck.id}`,
        label: `Camión · ${truck.name}`,
      })),
    ...trailers
      .filter(trailer => !trailer.archived || isCurrent('trailer', trailer.id))
      .map(trailer => ({
        value: `trailer:${trailer.id}`,
        label: `Remolque · ${trailer.name}`,
      })),
  ]

  return (
    <EditorLayout
      section={section}
      item={tank}
      id={id}
      canWrite={canWrite}
      formId={FORM_ID}
      saving={isSubmitting}
    >
      <Box
        component="form"
        id={FORM_ID}
        noValidate
        aria-label="Datos del tanque"
        onSubmit={event => {
          // From a model: the model is the one thing to choose
          if (describe === 'template' && !template) {
            event.preventDefault()
            setError('templateId', { message: 'Elige un modelo' })
            setFocus('templateId')
            return
          }
          void handleSubmit(onSubmit, details.onInvalid)(event)
        }}
      >
        <Stack spacing={5}>
          <TextField
            id="name"
            label="Nombre del tanque"
            placeholder="Tanque izquierdo"
            error={errors.name?.message}
            registration={register('name')}
          />
          <AutocompleteField
            id="equipment"
            label="Pertenece a"
            options={equipmentOptions}
            control={control}
            name="equipment"
            disabled={!canWrite}
          />
          <ChoiceButtonsBase
            id="describe"
            label="¿Cómo lo describes?"
            options={[
              { value: 'template', label: 'De un modelo' },
              { value: 'measures', label: 'Con sus medidas' },
            ]}
            value={describe}
            disabled={!canWrite}
            onChange={next => {
              setDescribe(next as Describe)
              // Back to the model: its measures again
              if (next === 'template' && values.templateId) {
                applyTemplate(values.templateId)
              }
            }}
          />

          {describe === 'template' ? (
            <>
              <AutocompleteField
                id="templateId"
                label="Modelo"
                placeholder="Busca por galones o medidas"
                options={TANK_TEMPLATES.map(item => ({
                  value: item.id,
                  label: item.label,
                }))}
                hint="Un tanque común: llena forma, medidas y capacidad."
                error={errors.templateId?.message}
                control={control}
                name="templateId"
                disabled={!canWrite}
                onChange={applyTemplate}
              />
              {template && (
                <Box sx={summaryBox}>
                  <TankShapeIcon shape="cylinder" size={56} />
                  <Typography variant="body2" role="status">
                    {`Cilíndrico, horizontal · ${template.label}`}
                  </Typography>
                </Box>
              )}
            </>
          ) : (
            <>
              <SelectField
                id="shape"
                label="Forma"
                options={TANK_SHAPES.map(shape => ({
                  value: shape,
                  label: TANK_SHAPE_LABELS[shape],
                }))}
                control={control}
                name="shape"
                disabled={!canWrite}
              />
              <ChoiceButtons
                id="orientation"
                label="Posición"
                options={TANK_ORIENTATIONS.map(orientation => ({
                  value: orientation,
                  label: TANK_ORIENTATION_LABELS[orientation],
                }))}
                control={control}
                name="orientation"
                disabled={!canWrite}
              />

              <Box sx={summaryBox}>
                <TankShapeIcon shape={values.shape} size={56} />
                <Typography variant="body2" role="status">
                  {volume === null
                    ? 'Escribe las medidas para calcular cuánto cabe.'
                    : `Según las medidas caben unos ${formatNumber(Math.round(volume))} galones.`}
                </Typography>
              </Box>

              {values.shape === 'cylinder' ? (
                <NumberField
                  id="diameter"
                  label="Diámetro"
                  unit="pulg."
                  placeholder="Ej. 25"
                  hint="De lado a lado, por fuera."
                  error={errors.diameter?.message}
                  registration={register('diameter')}
                />
              ) : (
                <>
                  <NumberField
                    id="height"
                    label="Alto"
                    unit="pulg."
                    placeholder="Ej. 24"
                    hint={
                      values.shape === 'd_flat_side'
                        ? 'Del fondo al techo, en el lado plano.'
                        : 'Del fondo al punto más alto.'
                    }
                    error={errors.height?.message}
                    registration={register('height')}
                  />
                  <NumberField
                    id="width"
                    label="Ancho"
                    unit="pulg."
                    placeholder="Ej. 30"
                    hint={
                      values.shape === 'd_flat_side'
                        ? 'Del lado plano al punto más saliente de la curva.'
                        : 'De lado a lado.'
                    }
                    error={errors.width?.message}
                    registration={register('width')}
                  />
                </>
              )}
              <NumberField
                id="length"
                label={
                  values.orientation === 'vertical'
                    ? 'Altura del tanque'
                    : 'Largo'
                }
                unit="pulg."
                placeholder="Ej. 48"
                hint={
                  values.orientation === 'vertical'
                    ? 'De pie: de la base a la tapa.'
                    : 'De punta a punta.'
                }
                error={errors.length?.message}
                registration={register('length')}
              />
              <NumberField
                id="capacity"
                label="Capacidad"
                unit="gal"
                placeholder="Ej. 120"
                hint={
                  capacityLooksOff
                    ? `Las medidas dan unos ${formatNumber(Math.round(volume))} galones. Revisa las medidas o la capacidad.`
                    : 'La que indica el fabricante o la placa del tanque.'
                }
                error={errors.capacity?.message}
                registration={register('capacity')}
              />
            </>
          )}
          <MoreDetails
            open={details.open}
            onToggle={details.toggle}
            filled={countFilled([values.description])}
          >
            <TextField
              id="description"
              label="Descripción (opcional)"
              error={errors.description?.message}
              registration={register('description')}
            />
          </MoreDetails>
        </Stack>
      </Box>
    </EditorLayout>
  )
}
