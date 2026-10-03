import type {
  Control,
  FieldErrors,
  FieldPath,
  FieldValues,
  UseFormRegister,
} from 'react-hook-form'
import Box from '@mui/material/Box'
import ChoiceButtons from 'components/ChoiceButtons'
import MeasureGuide from 'components/MeasureGuide'
import MeasureHelp from 'components/MeasureHelp'
import NumberField from 'components/NumberField'
import SelectField from 'components/SelectField'
import TankPreview from 'components/TankPreview'
import {
  TANK_ORIENTATION_LABELS,
  TANK_SHAPE_LABELS,
  type TankMeasureLimits,
  type TankMeasureValues,
} from 'schemas/tankMeasures'
import { measureHelp, type MeasureName } from 'utils/measureHelp'
import { parseDecimal } from 'utils/parseDecimal'
import { TANK_ORIENTATIONS, TANK_SHAPES } from 'utils/tankVolume'

/** A typed measure for the preview: null unless a positive number. */
const positive = (value: string | undefined) => {
  const number = parseDecimal(value ?? '')
  return Number.isFinite(number) && number > 0 ? number : null
}

const range = ({ min, max }: { min: number; max: number }, unit: string) =>
  `Entre ${String(min)} y ${String(max)} ${unit}.`

type Field = keyof TankMeasureValues

/**
 * A tank's shape, position, capacity and measures, with the help of each,
 * the measuring guide and the 3D preview (backend specs/0013). The same in
 * the fleet's tank and in "Agrega tu tanque" without an account (specs/0019
 * RF-5): what is fixed in one is fixed in both.
 */
export default function TankFields<T extends FieldValues>({
  control,
  register,
  errors,
  values,
  disabled = false,
  limits,
}: {
  control: Control<T>
  register: UseFormRegister<T>
  errors: FieldErrors<T>
  /** The form's current values (useWatch). */
  values: TankMeasureValues
  disabled?: boolean
  /** Shows each field's range under it. */
  limits?: TankMeasureLimits
}) {
  // The form holds these fields among others: their names are its paths
  const path = (field: Field) => field as FieldPath<T>
  const error = (field: Field) =>
    (errors as FieldErrors<TankMeasureValues>)[field]?.message
  const cylinder = values.shape === 'cylinder'
  const vertical = values.orientation === 'vertical'
  const helpFor = (measure: MeasureName, name: string) => (
    <MeasureHelp
      label={name}
      text={measureHelp(measure, values.shape, values.orientation)}
    />
  )
  // A field's range under it, when the form shows them
  const hint = (text: string | undefined) => (text ? { hint: text } : {})
  const sectionHint = hint(limits && range(limits.section, 'pulg'))

  return (
    <>
      <SelectField
        id="shape"
        label="Forma"
        options={TANK_SHAPES.map(shape => ({
          value: shape,
          label: TANK_SHAPE_LABELS[shape],
        }))}
        control={control}
        name={path('shape')}
        disabled={disabled}
      />
      <ChoiceButtons
        id="orientation"
        label="Posición"
        options={TANK_ORIENTATIONS.map(orientation => ({
          value: orientation,
          label: TANK_ORIENTATION_LABELS[orientation],
        }))}
        control={control}
        name={path('orientation')}
        disabled={disabled}
      />

      <NumberField
        id="capacity"
        label="Capacidad"
        unit="gal"
        placeholder="Ej. 120"
        hint={
          limits
            ? `La de la placa del tanque. ${range(limits.capacity, 'galones')}`
            : 'La que indica la placa del tanque.'
        }
        help={helpFor('capacity', 'la capacidad')}
        error={error('capacity')}
        registration={register(path('capacity'))}
      />
      <MeasureGuide shape={values.shape} orientation={values.orientation} />
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
            {...sectionHint}
            help={helpFor('diameter', 'el diámetro')}
            error={error('diameter')}
            registration={register(path('diameter'))}
          />
        ) : (
          <>
            <NumberField
              id="height"
              dense
              label="Alto"
              unit="pulg."
              placeholder="24"
              {...sectionHint}
              help={helpFor('height', 'el alto')}
              error={error('height')}
              registration={register(path('height'))}
            />
            <NumberField
              id="width"
              dense
              label="Ancho"
              unit="pulg."
              placeholder="30"
              {...sectionHint}
              help={helpFor('width', 'el ancho')}
              error={error('width')}
              registration={register(path('width'))}
            />
          </>
        )}
        <NumberField
          id="length"
          dense
          label={vertical ? 'Altura' : 'Largo'}
          unit="pulg."
          placeholder="48"
          {...hint(limits && range(limits.length, 'pulg'))}
          help={helpFor('length', vertical ? 'la altura' : 'el largo')}
          error={error('length')}
          registration={register(path('length'))}
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
  )
}
