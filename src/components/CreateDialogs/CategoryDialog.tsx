import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import TextField from 'components/TextField'
import {
  CATEGORY_NAME_MAX,
  categoryFormSchema,
  categoryWithName,
  duplicateCategoryMessage,
  type CategoryFormValues,
  type ExpenseCategory,
} from 'schemas/expenseCategories'
// Only lazy pages open this dialog: the SDK stays out of the basic mode
import { createCategory, newExpenseId, updateCategory } from 'services/expenses'
import { useExpensesStore } from 'store/expenses'
import { recoverFromLostPermission } from 'store/session'
import { squeezeSpaces } from 'utils/foldText'
import { reportError } from 'utils/reportError'
import CreateDialog from './CreateDialog'

interface CategoryDialogProps {
  /** null: a new one. */
  category: ExpenseCategory | null
  orgId: string
  /** What was typed in the list (specs/0028). */
  initialName?: string
  /** A new one, to choose it where it was asked for (specs/0028). */
  onCreated?: (id: string) => void
  onClose: () => void
}

/**
 * "Agregar categoría" and "Renombrar" (backend specs/0026 RF-11), and
 * "+ Crear categoría" in an expense (specs/0028).
 */
export default function CategoryDialog({
  category,
  orgId,
  initialName = '',
  onCreated,
  onClose,
}: CategoryDialogProps) {
  const categories = useExpensesStore(state => state.categories)
  const saveCategory = useExpensesStore(state => state.saveCategory)
  // Its id exists from the moment the dialog opens (ADR 0003)
  const [id] = useState(() => category?.id ?? newExpenseId())
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<CategoryFormValues>({
    resolver: zodResolver(categoryFormSchema),
    defaultValues: { name: category?.name ?? initialName },
  })

  const onSubmit = ({ name }: CategoryFormValues) => {
    const other = categoryWithName(name, categories, id)
    if (other) {
      setError(
        'name',
        { message: duplicateCategoryMessage(other) },
        { shouldFocus: true }
      )
      return
    }
    const trimmed = squeezeSpaces(name)
    saveCategory(
      category
        ? { ...category, name: trimmed }
        : { id, orgId, name: trimmed, system: null, archived: false },
      () =>
        category
          ? updateCategory(id, { name: trimmed })
          : createCategory(id, orgId, trimmed)
    ).catch((error: unknown) => {
      reportError(error, { operation: 'saveExpenseCategory' })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos guardar la categoría',
        description: 'Vuelve a intentarlo.',
      })
    })
    sileo.success({
      title: 'Categoría guardada',
      ...(!navigator.onLine && {
        description: 'Se subirá cuando tengas señal.',
      }),
    })
    if (!category) onCreated?.(id)
    onClose()
  }

  return (
    <CreateDialog
      title={category ? 'Renombrar categoría' : 'Nueva categoría'}
      formId="category-form"
      saveLabel="Guardar"
      onSubmit={event => {
        void handleSubmit(onSubmit)(event)
      }}
      onClose={onClose}
    >
      <TextField
        id="categoryName"
        label="Nombre"
        placeholder="Lavado"
        maxLength={CATEGORY_NAME_MAX}
        error={errors.name?.message}
        registration={register('name')}
      />
    </CreateDialog>
  )
}
