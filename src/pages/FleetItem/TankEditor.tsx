import { useState } from 'react'
import { useForm, useWatch, type FieldErrors } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import AutocompleteField from 'components/AutocompleteField'
import ChoiceButtons, { ChoiceButtonsBase } from 'components/ChoiceButtons'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import MeasureGuide from 'components/MeasureGuide'
import MeasureHelp from 'components/MeasureHelp'
import TankPreview from 'components/TankPreview'
import TextField from 'components/TextField'
import {
  TANK_ORIENTATION_LABELS,
  TANK_SHAPE_LABELS,
  tankFormSchema,
  tankFromForm,
  tankToForm,
  type FleetTank,
  type TankFormValues,
} from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import { formatNumber } from 'utils/formatNumber'
import { measureHelp, type MeasureName } from 'utils/measureHelp'
import { parseDecimal } from 'utils/parseDecimal'
import { TANK_TEMPLATES } from 'utils/tankTemplates'
import { TANK_ORIENTATIONS, TANK_SHAPES } from 'utils/tankVolume'
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

/** A typed measure for the preview: null unless a positive number. */
const positive = (value: string | undefined) => {
  const number = parseDecimal(value ?? '')
  return Number.isFinite(number) && number > 0 ? number : null
}

type Describe = 'template' | 'measures'

/** The model these values still are, if any. */
const templateOf = (values: TankFormValues) => {
  const template = TANK_TEMPLATES.find(item => item.id === values.templateId)
  return template !== undefined &&
    values.shape === 'cylinder' &&
    values.orientation === 'horizontal' &&
    parseDecimal(values.diameter) === template.diameterIn &&
    parseDecimal(values.length) === template.lengthIn &&
    // A capacity edited by hand is no longer the model (audit 2026-10-02)
    parseDecimal(values.capacity) === template.capacityGal
    ? template
    : null
}

// Shown only "Con sus medidas"
const MEASURES = [
  'shape',
  'orientation',
  'diameter',
  'height',
  'width',
  'length',
  'capacity',
] as const

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
  const cylinder = values.shape === 'cylinder'
  const vertical = values.orientation === 'vertical'
  const helpFor = (measure: MeasureName, name: string) => (
    <MeasureHelp
      label={name}
      text={measureHelp(measure, values.shape, values.orientation)}
    />
  )

  const applyTemplate = (templateId: string) => {
    const template = TANK_TEMPLATES.find(item => item.id === templateId)
    if (!template) return
    setValue('shape', 'cylinder')
    setValue('orientation', 'horizontal')
    setValue('diameter', formatNumber(template.diameterIn))
    setValue('length', formatNumber(template.lengthIn))
    setValue('capacity', formatNumber(template.capacityGal))
  }

  // From a model, the model is the one thing to choose. Inside handleSubmit,
  // so choosing one clears the message (audit 2026-10-02)
  const askForModel = () => {
    setError('templateId', { message: 'Elige un modelo' })
    setFocus('templateId')
  }

  const onValid = (formValues: TankFormValues) => {
    if (describe === 'template' && !template) {
      askForModel()
      return
    }
    onSubmit(formValues)
  }

  const onInvalid = (formErrors: FieldErrors<TankFormValues>) => {
    if (describe === 'template') {
      if (!template) {
        askForModel()
        return
      }
      // The model's measures failed (e.g. a capacity the rules refuse): an
      // error on a hidden field left Guardar doing nothing; show the measures
      const hidden = MEASURES.find(name => name in formErrors)
      if (hidden) {
        setDescribe('measures')
        setTimeout(() => {
          setFocus(hidden)
        }, 0)
        return
      }
    }
    details.onInvalid(formErrors)
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
          void handleSubmit(onValid, onInvalid)(event)
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
                <TankPreview
                  shape="cylinder"
                  orientation="horizontal"
                  diameter={template.diameterIn}
                  length={template.lengthIn}
                  capacity={template.capacityGal}
                />
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

              <NumberField
                id="capacity"
                label="Capacidad"
                unit="gal"
                placeholder="Ej. 120"
                hint="La que indica la placa del tanque."
                help={helpFor('capacity', 'la capacidad')}
                error={errors.capacity?.message}
                registration={register('capacity')}
              />
              <MeasureGuide
                shape={values.shape}
                orientation={values.orientation}
              />
              {/* All the measures on one row, on a phone too (specs/0013 RF-2) */}
              <Box
                sx={{
                  display: 'grid',
                  gridTemplateColumns: `repeat(${String(cylinder ? 2 : 3)}, minmax(0, 1fr))`,
                  gap: 2,
                }}
              >
                {cylinder ? (
                  <NumberField
                    id="diameter"
                    dense
                    label="Diámetro"
                    unit="pulg."
                    placeholder="25"
                    help={helpFor('diameter', 'el diámetro')}
                    error={errors.diameter?.message}
                    registration={register('diameter')}
                  />
                ) : (
                  <>
                    <NumberField
                      id="height"
                      dense
                      label="Alto"
                      unit="pulg."
                      placeholder="24"
                      help={helpFor('height', 'el alto')}
                      error={errors.height?.message}
                      registration={register('height')}
                    />
                    <NumberField
                      id="width"
                      dense
                      label="Ancho"
                      unit="pulg."
                      placeholder="30"
                      help={helpFor('width', 'el ancho')}
                      error={errors.width?.message}
                      registration={register('width')}
                    />
                  </>
                )}
                <NumberField
                  id="length"
                  dense
                  label={vertical ? 'Altura' : 'Largo'}
                  unit="pulg."
                  placeholder="48"
                  help={helpFor('length', vertical ? 'la altura' : 'el largo')}
                  error={errors.length?.message}
                  registration={register('length')}
                />
              </Box>
              <TankPreview
                shape={values.shape}
                orientation={values.orientation}
                diameter={positive(values.diameter)}
                height={positive(values.height)}
                width={positive(values.width)}
                length={positive(values.length)}
                capacity={positive(values.capacity)}
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
