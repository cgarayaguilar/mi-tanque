import { useForm, useWatch } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import Stack from '@mui/material/Stack'
import AutocompleteField from 'components/AutocompleteField'
import type { CreateKind } from 'components/CreateDialogs'
import CreateDialog from 'components/CreateDialogs/CreateDialog'
import DateTimeField from 'components/DateTimeField'
import MoreDetails, {
  countFilled,
  useMoreDetails,
} from 'components/MoreDetails'
import NumberField from 'components/NumberField'
import type { SelectOption } from 'components/SelectField'
import TextField from 'components/TextField'
import type { Currency } from 'schemas/account'
import {
  expenseRowSchema,
  TRIP_LIMITS,
  type ExpenseRowValues,
} from 'schemas/trips'
import { currencySymbol } from 'utils/formatMoney'

// Behind "Ver más detalles" (specs/0029 RF-4); the description is in
// sight (specs/0036)
const DETAILS = ['driverId'] as const

interface ExpenseRowDialogProps {
  row: ExpenseRowValues
  /** Not in the trip's form yet: "Nuevo gasto". */
  isNew: boolean
  currency: Currency
  categoryOptions: readonly SelectOption[]
  driverOptions: readonly SelectOption[]
  /** "+ Crear …" of its lists (specs/0028). */
  create: (
    kind: CreateKind,
    text: string,
    onCreated: (id: string) => void
  ) => void
  onSave: (row: ExpenseRowValues) => void
  onClose: () => void
}

/**
 * "Nuevo gasto" of the trip (backend specs/0029 RF-4), with the fields of a
 * trip's expense (0026 RF-12) and its driver: it only changes the form; the
 * trip saves it, in its batch.
 */
export default function ExpenseRowDialog({
  row,
  isNew,
  currency,
  categoryOptions,
  driverOptions,
  create,
  onSave,
  onClose,
}: ExpenseRowDialogProps) {
  const {
    register,
    handleSubmit,
    control,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<ExpenseRowValues>({
    resolver: zodResolver(expenseRowSchema),
    defaultValues: row,
  })
  const values = useWatch({ control })
  const details = useMoreDetails<ExpenseRowValues>(DETAILS, setFocus)

  return (
    <CreateDialog
      title={isNew ? 'Nuevo gasto' : 'Editar gasto'}
      formId="trip-expense"
      saveLabel="Guardar"
      onSubmit={event => {
        void handleSubmit(values => {
          onSave(values)
          onClose()
        }, details.onInvalid)(event)
      }}
      onClose={onClose}
    >
      <Stack spacing={6}>
        <AutocompleteField
          id="tripExpenseCategory"
          label="Categoría"
          options={categoryOptions}
          placeholder="Elige la categoría"
          error={errors.categoryId?.message}
          control={control}
          name="categoryId"
          create={{
            label: 'Crear categoría',
            onCreate: text => {
              create('category', text, id => {
                setValue('categoryId', id, { shouldValidate: true })
              })
            },
          }}
        />
        <NumberField
          id="tripExpenseAmount"
          label="Monto"
          prefix={currencySymbol(currency)}
          placeholder="1,850"
          error={errors.amount?.message}
          registration={register('amount')}
        />
        {/* What it was, in sight: fundamental (specs/0036) */}
        <TextField
          id="tripExpenseDescription"
          label="Descripción (opcional)"
          placeholder="Peaje de Tipitapa"
          maxLength={TRIP_LIMITS.expenseDescription}
          error={errors.description?.message}
          registration={register('description')}
        />
        <DateTimeField
          id="tripExpenseTakenAt"
          label="Fecha y hora"
          control={control}
          name="takenAt"
          error={errors.takenAt?.message}
        />
        <MoreDetails
          open={details.open}
          onToggle={details.toggle}
          filled={countFilled([values.driverId])}
        >
          <AutocompleteField
            id="tripExpenseDriver"
            label="Conductor (opcional)"
            options={[{ value: '', label: 'Sin conductor' }, ...driverOptions]}
            control={control}
            name="driverId"
            create={{
              label: 'Crear conductor',
              onCreate: text => {
                create('driver', text, id => {
                  setValue('driverId', id)
                })
              },
            }}
          />
        </MoreDetails>
      </Stack>
    </CreateDialog>
  )
}
