import { useState } from 'react'
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import AutocompleteField from 'components/AutocompleteField'
import { ChoiceButtonsBase } from 'components/ChoiceButtons'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import ModelPicker from 'components/ModelPicker'
import TankFields from 'components/TankFields'
import TankPreview from 'components/TankPreview'
import TextField from 'components/TextField'
import {
  tankFormSchema,
  tankFromForm,
  tankToForm,
  type FleetTank,
  type TankFormValues,
} from 'schemas/fleet'
import { useFleetStore } from 'store/fleet'
import type { FleetSection } from 'utils/fleetSections'
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { catalogFilterFor } from 'data/truckModels'
import { templateById } from 'utils/tankTemplates'
import { useCreateDialogs } from 'components/CreateDialogs'
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

type Describe = 'template' | 'measures'

/** `/flota/tanques/nuevo?equipo=truck:{id}`: the equipment to choose. */
const equipmentInAddress = () => {
  const value = new URLSearchParams(window.location.search).get('equipo')
  return value && /^(truck|trailer):[\w-]+$/.test(value) ? value : null
}

/** The model these values still are, if any. */
const templateOf = (values: TankFormValues) => {
  const template = templateById(values.templateId)
  if (template === undefined) return null
  const same = (typed: string, value: number) => parseDecimal(typed) === value
  const { dimensions } = template
  const measures =
    'diameterIn' in dimensions
      ? same(values.diameter, dimensions.diameterIn)
      : same(values.height, dimensions.heightIn) &&
        same(values.width, dimensions.widthIn)
  return values.shape === template.shape &&
    values.orientation === 'horizontal' &&
    measures &&
    same(values.length, dimensions.lengthIn) &&
    // A capacity edited by hand is no longer the model (audit 2026-10-02)
    same(values.capacity, template.capacityGal)
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
    defaultValues: tank
      ? tankToForm(tank)
      : // "Agregar tanque" of an equipment brings it chosen (specs/0031 RF-4)
        { ...tankToForm(null), equipment: equipmentInAddress() ?? 'none' },
    disabled: !canWrite,
  })
  // "+ Crear camión" and "+ Crear remolque" in "Pertenece a" (specs/0031)
  const { create, dialog } = useCreateDialogs(orgId)
  const values = useWatch({ control }) as TankFormValues
  // How the tank is described (RF-9): a new one starts from a model; an
  // existing one opens the way it is
  const [describe, setDescribe] = useState<Describe>(() =>
    tank === null || templateOf(tankToForm(tank)) ? 'template' : 'measures'
  )
  const template = templateById(values.templateId)
  const details = useMoreDetails<TankFormValues>(['description'], setFocus)

  const applyTemplate = (templateId: string) => {
    const template = templateById(templateId)
    if (!template) return
    const { dimensions } = template
    setValue('shape', template.shape)
    setValue('orientation', 'horizontal')
    if ('diameterIn' in dimensions) {
      setValue('diameter', formatNumber(dimensions.diameterIn))
    } else {
      setValue('height', formatNumber(dimensions.heightIn))
      setValue('width', formatNumber(dimensions.widthIn))
    }
    setValue('length', formatNumber(dimensions.lengthIn))
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

  // The catalog opens on the tank's truck (specs/0016 RF-6, RF-7)
  const ownerTruck = values.equipment.startsWith('truck:')
    ? trucks.find(truck => `truck:${truck.id}` === values.equipment)
    : undefined
  const truckFilter = ownerTruck
    ? catalogFilterFor(ownerTruck.brand, ownerTruck.model, ownerTruck.year)
    : null

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
            create={[
              {
                label: 'Crear camión',
                onCreate: text => {
                  create('truck', text, truckId => {
                    setValue('equipment', `truck:${truckId}`)
                  })
                },
              },
              {
                label: 'Crear remolque',
                onCreate: text => {
                  create('trailer', text, trailerId => {
                    setValue('equipment', `trailer:${trailerId}`)
                  })
                },
              },
            ]}
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
              <Controller
                control={control}
                name="templateId"
                render={({ field }) => (
                  <ModelPicker
                    id="templateId"
                    value={field.value}
                    hint="Por la marca y el modelo de tu camión: llena forma, medidas y capacidad."
                    error={errors.templateId?.message}
                    disabled={!canWrite}
                    buttonRef={field.ref}
                    truckFilter={truckFilter}
                    onChange={templateId => {
                      field.onChange(templateId)
                      applyTemplate(templateId)
                    }}
                  />
                )}
              />
              {template && (
                <TankPreview
                  shape={template.shape}
                  orientation="horizontal"
                  {...('diameterIn' in template.dimensions
                    ? { diameter: template.dimensions.diameterIn }
                    : {
                        height: template.dimensions.heightIn,
                        width: template.dimensions.widthIn,
                      })}
                  length={template.dimensions.lengthIn}
                  capacity={template.capacityGal}
                  adjusted={template.sourced}
                />
              )}
            </>
          ) : (
            <TankFields
              control={control}
              register={register}
              errors={errors}
              values={values}
              disabled={!canWrite}
            />
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
      {dialog}
    </EditorLayout>
  )
}
