import { useState, type ReactNode } from 'react'
import {
  Controller,
  useForm,
  useWatch,
  type FieldErrors,
} from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
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
import { formatNumber } from 'utils/formatNumber'
import { parseDecimal } from 'utils/parseDecimal'
import { templateById } from 'utils/tankTemplates'

type Describe = 'template' | 'measures'

/** What a tank's form writes. */
export type TankFormFields = ReturnType<typeof tankFromForm>

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

interface UseTankFormOptions {
  tank: FleetTank | null
  /** A new tank's first values: its equipment, or a tank still unsaved. */
  defaults?: Partial<TankFormValues>
  disabled?: boolean
}

/**
 * A tank's form (specs/0013 to 0015), for its screen and the dialog of a
 * truck or a trailer (backend specs/0032 RNF-1): how it is described, its
 * model, and what it writes.
 */
export const useTankForm = ({
  tank,
  defaults,
  disabled = false,
}: UseTankFormOptions) => {
  const form = useForm<TankFormValues>({
    resolver: zodResolver(tankFormSchema),
    defaultValues: { ...tankToForm(tank), ...defaults },
    disabled,
  })
  const { setValue, setError, setFocus, handleSubmit, control } = form
  const values = useWatch({ control }) as TankFormValues
  // How the tank is described (RF-9): a new one starts from a model; an
  // existing one opens the way it is
  const [describe, setDescribe] = useState<Describe>(() => {
    const opened = { ...tankToForm(tank), ...defaults }
    return (tank === null && !defaults?.shape) || templateOf(opened)
      ? 'template'
      : 'measures'
  })
  const template = templateById(values.templateId)
  const details = useMoreDetails<TankFormValues>(['description'], setFocus)

  const applyTemplate = (templateId: string) => {
    const chosen = templateById(templateId)
    if (!chosen) return
    const { dimensions } = chosen
    setValue('shape', chosen.shape)
    setValue('orientation', 'horizontal')
    if ('diameterIn' in dimensions) {
      setValue('diameter', formatNumber(dimensions.diameterIn))
    } else {
      setValue('height', formatNumber(dimensions.heightIn))
      setValue('width', formatNumber(dimensions.widthIn))
    }
    setValue('length', formatNumber(dimensions.lengthIn))
    setValue('capacity', formatNumber(chosen.capacityGal))
  }

  const chooseDescribe = (next: Describe) => {
    setDescribe(next)
    // Back to the model: its measures again
    if (next === 'template' && values.templateId) {
      applyTemplate(values.templateId)
    }
  }

  // From a model, the model is the one thing to choose. Inside handleSubmit,
  // so choosing one clears the message (audit 2026-10-02)
  const askForModel = () => {
    setError('templateId', { message: 'Elige un modelo' })
    setFocus('templateId')
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

  /**
   * The form's submit: `onSave` gets what to write, with the model kept
   * only while the tank still is that model.
   */
  const submit = (
    onSave: (fields: TankFormFields, values: TankFormValues) => void
  ) =>
    handleSubmit(formValues => {
      if (describe === 'template' && !template) {
        askForModel()
        return
      }
      const fields = tankFromForm(formValues)
      if (!templateOf(formValues)) fields.templateId = null
      onSave(fields, formValues)
    }, onInvalid)

  return {
    form,
    values,
    describe,
    chooseDescribe,
    template,
    details,
    applyTemplate,
    submit,
  }
}

export type TankForm = ReturnType<typeof useTankForm>

interface TankFormViewProps {
  tankForm: TankForm
  /** The catalog opens on this truck's brand and model (specs/0016). */
  truckFilter: { brand: string; model: string | null } | null
  disabled?: boolean
  /** Before each id: the dialog over a truck's form, which has its own. */
  idPrefix?: string
  /** After its name: "Pertenece a", on the tank's own screen. */
  equipmentField?: ReactNode
}

/** A tank's fields: its name, its model or its measures, and the rest. */
export default function TankFormView({
  tankForm,
  truckFilter,
  disabled = false,
  idPrefix = '',
  equipmentField,
}: TankFormViewProps) {
  const { form, values, describe, chooseDescribe, template, details } = tankForm
  const {
    control,
    register,
    formState: { errors },
  } = form
  return (
    <Stack spacing={5}>
      <TextField
        id={`${idPrefix}name`}
        label="Nombre del tanque"
        placeholder="Tanque izquierdo"
        error={errors.name?.message}
        registration={register('name')}
      />
      {equipmentField}
      <ChoiceButtonsBase
        id={`${idPrefix}describe`}
        label="¿Cómo lo describes?"
        options={[
          { value: 'template', label: 'De un modelo' },
          { value: 'measures', label: 'Con sus medidas' },
        ]}
        value={describe}
        disabled={disabled}
        onChange={next => {
          chooseDescribe(next as Describe)
        }}
      />

      {describe === 'template' ? (
        <>
          <Controller
            control={control}
            name="templateId"
            render={({ field }) => (
              <ModelPicker
                id={`${idPrefix}templateId`}
                value={field.value}
                hint="Por la marca y el modelo de tu camión: llena forma, medidas y capacidad."
                error={errors.templateId?.message}
                disabled={disabled}
                buttonRef={field.ref}
                truckFilter={truckFilter}
                onChange={templateId => {
                  field.onChange(templateId)
                  tankForm.applyTemplate(templateId)
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
          disabled={disabled}
        />
      )}
      <MoreDetails
        open={details.open}
        onToggle={details.toggle}
        filled={countFilled([values.description])}
      >
        <TextField
          id={`${idPrefix}description`}
          label="Descripción (opcional)"
          error={errors.description?.message}
          registration={register('description')}
        />
      </MoreDetails>
    </Stack>
  )
}
