import { useEffect, useState } from 'react'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import EmptyState from 'components/EmptyState'
import { FilterBar, FilterToggle } from 'components/FilterChip'
import SessionGate from 'components/SessionGate'
import CategoryDialog from 'components/CreateDialogs/CategoryDialog'
import type { ExpenseCategory } from 'schemas/expenseCategories'
import { updateCategory } from 'services/expenses'
import { useExpensesStore } from 'store/expenses'
import {
  recoverFromLostPermission,
  selectActiveRole,
  useSessionStore,
} from 'store/session'
import { radius } from 'theme/tokens'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'
import { RETRY_HINT } from 'utils/withTimeout'

const failed = (operation: string, title: string) => (error: unknown) => {
  reportError(error, { operation })
  if (recoverFromLostPermission(error)) return
  sileo.error({ title, description: 'Vuelve a intentarlo.' })
}

function CategoryRow({
  category,
  canWrite,
  onRename,
}: {
  category: ExpenseCategory
  canWrite: boolean
  onRename: () => void
}) {
  const saveCategory = useExpensesStore(state => state.saveCategory)
  const fuel = category.system === 'fuel'

  const setArchived = (archived: boolean) => {
    saveCategory({ ...category, archived }, () =>
      updateCategory(category.id, { archived })
    ).catch(
      failed(
        'archiveExpenseCategory',
        archived
          ? 'No pudimos archivar la categoría'
          : 'No pudimos restaurar la categoría'
      )
    )
    sileo.success({
      title: archived ? 'Categoría archivada' : 'Categoría restaurada',
    })
  }

  return (
    <Box
      sx={{
        px: 4,
        py: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
      }}
    >
      <Typography
        component="h2"
        variant="subtitle1"
        sx={{ overflowWrap: 'anywhere' }}
      >
        {category.name}
      </Typography>
      {fuel && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          La usan los rellenos
        </Typography>
      )}
      {canWrite && (
        <Box sx={{ display: 'flex', gap: 2, mt: 2, ml: -2 }}>
          <Button
            size="small"
            onClick={onRename}
            aria-label={`Renombrar ${category.name}`}
          >
            Renombrar
          </Button>
          {/* Fuel is the refuels' (specs/0027): it stays */}
          {!fuel && (
            <Button
              size="small"
              onClick={() => {
                setArchived(!category.archived)
              }}
              aria-label={`${category.archived ? 'Restaurar' : 'Archivar'} ${category.name}`}
            >
              {category.archived ? 'Restaurar' : 'Archivar'}
            </Button>
          )}
        </Box>
      )}
    </Box>
  )
}

function CategoriesScreen() {
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const role = useSessionStore(selectActiveRole)
  const canWrite = canWriteFleet(role)
  const categories = useExpensesStore(state => state.categories)
  const status = useExpensesStore(state => state.categoriesStatus)
  const loadCategories = useExpensesStore(state => state.loadCategories)
  const [archived, setArchived] = useState(false)
  // undefined: closed; null: a new one
  const [editing, setEditing] = useState<ExpenseCategory | null | undefined>()

  useEffect(() => {
    if (orgId) void loadCategories(orgId)
  }, [orgId, loadCategories])

  const shown = categories.filter(category => category.archived === archived)

  const body = () => {
    if (status === 'error' && categories.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar las categorías"
          description={RETRY_HINT}
          action={{
            label: 'Reintentar',
            onClick: () => void loadCategories(orgId),
          }}
        />
      )
    }
    if (status !== 'ready' && categories.length === 0) {
      return (
        <Stack spacing={2} aria-busy="true" aria-label="Cargando categorías">
          {[0, 1, 2].map(index => (
            <Skeleton
              key={index}
              variant="rounded"
              height={88}
              sx={{ borderRadius: `${String(radius.lg)}px` }}
            />
          ))}
        </Stack>
      )
    }
    if (shown.length === 0) {
      return (
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {archived
            ? 'No hay categorías archivadas.'
            : 'No hay categorías activas.'}
        </Typography>
      )
    }
    return (
      <Stack
        component="ul"
        spacing={2}
        aria-label="Categorías"
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {shown.map(category => (
          <li key={category.id}>
            <CategoryRow
              category={category}
              canWrite={canWrite}
              onRename={() => {
                setEditing(category)
              }}
            />
          </li>
        ))}
      </Stack>
    )
  }

  // Back to where it was opened: "Más" or Gastos (specs/0034 RF-9)
  const fromMore =
    new URLSearchParams(window.location.search).get('desde') === 'mas'

  return (
    <Box component="main" sx={{ px: 4, pt: 2, pb: 8 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => {
          navigate(fromMore ? '/mas' : '/gastos')
        }}
        sx={{ ml: -2, mb: 2 }}
      >
        {fromMore ? 'Más' : 'Gastos'}
      </Button>
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: 2,
          mb: 4,
        }}
      >
        <Typography variant="pageTitle">Categorías</Typography>
        {canWrite && (
          <Button
            variant="contained"
            startIcon={<AddIcon />}
            onClick={() => {
              setEditing(null)
            }}
          >
            Agregar categoría
          </Button>
        )}
      </Box>
      <Box sx={{ mb: 4 }}>
        <FilterBar>
          <FilterToggle
            label="Archivadas"
            on={archived}
            onChange={setArchived}
          />
        </FilterBar>
      </Box>
      {body()}
      {editing !== undefined && (
        <CategoryDialog
          category={editing}
          orgId={orgId}
          onClose={() => {
            setEditing(undefined)
          }}
        />
      )}
    </Box>
  )
}

export default function ExpenseCategories() {
  return (
    <SessionGate needs="ready">
      <CategoriesScreen />
    </SessionGate>
  )
}
