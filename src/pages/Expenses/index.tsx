import { lazy, Suspense, useEffect, useMemo, useState } from 'react'
import { useLocation } from 'wouter'
import Alert from '@mui/material/Alert'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import ButtonBase from '@mui/material/ButtonBase'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import AddIcon from '@mui/icons-material/Add'
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth'
import CloudOffIcon from '@mui/icons-material/CloudOff'
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong'
import SearchOffIcon from '@mui/icons-material/SearchOff'
import EmptyState from 'components/EmptyState'
import FilterChip, { FilterBar } from 'components/FilterChip'
import NavBar from 'components/NavBar'
import SessionGate from 'components/SessionGate'
import {
  EXPENSE_KIND_LABELS,
  EXPENSE_KINDS,
  expenseLinkText,
  totalsByCategory,
  totalsByCurrency,
  type Expense,
  type ExpenseKind,
} from 'schemas/expenses'
import { expensesPeriodOf, useExpensesStore } from 'store/expenses'
import { useFleetStore } from 'store/fleet'
import { selectActiveRole, useSessionStore } from 'store/session'
import { layout, radius, softShadow, typeScale } from 'theme/tokens'
import { formatMeasurementDate, formatPeriod } from 'utils/formatDate'
import { moneyTotal } from 'utils/formatMoney'
import { canWriteFleet } from 'utils/roles'
import { RETRY_HINT } from 'utils/withTimeout'

const DateModal = lazy(() => import('components/DateModal'))

const KIND_OPTIONS = EXPENSE_KINDS.map(kind => ({
  value: kind,
  label: EXPENSE_KIND_LABELS[kind],
}))

/** The names in a period's expenses, once each, for a filter's options. */
const optionsOf = (pairs: [string, string][]) =>
  [...new Map(pairs)]
    .map(([value, label]) => ({ value, label }))
    .sort((a, b) => a.label.localeCompare(b.label, 'es'))

/** The names shown are the current ones; the saved copy if it is gone. */
const useCurrentNames = () => {
  const categories = useExpensesStore(state => state.categories)
  const { trucks, trailers } = useFleetStore()
  return useMemo(() => {
    const byId = (items: readonly { id: string; name: string }[]) =>
      new Map(items.map(item => [item.id, item.name]))
    const category = byId(categories)
    const truck = byId(trucks)
    const trailer = byId(trailers)
    return {
      category: (id: string) => category.get(id) ?? null,
      link: (expense: Expense) =>
        expenseLinkText({
          ...expense,
          truckName:
            (expense.truckId && truck.get(expense.truckId)) ||
            expense.truckName,
          trailerName:
            (expense.trailerId && trailer.get(expense.trailerId)) ||
            expense.trailerName,
        }),
    }
  }, [categories, trucks, trailers])
}

function ExpenseCard({
  expense,
  names,
  onClick,
}: {
  expense: Expense
  names: ReturnType<typeof useCurrentNames>
  onClick: () => void
}) {
  const category = names.category(expense.categoryId) ?? expense.categoryName
  const amount = moneyTotal(expense.currency, expense.amount)
  return (
    <ButtonBase
      onClick={onClick}
      aria-label={`Gasto de ${category}, ${amount}`}
      sx={{
        width: '100%',
        display: 'block',
        px: 4,
        py: 3,
        textAlign: 'left',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
        transition: 'box-shadow 0.15s',
        '&:hover': { boxShadow: softShadow },
      }}
    >
      <Typography
        component="span"
        variant="subtitle1"
        sx={{ display: 'block', overflowWrap: 'anywhere' }}
      >
        {category}
      </Typography>
      <Typography
        component="span"
        noWrap
        sx={{ ...typeScale.figureSm, display: 'block', my: 0.5 }}
      >
        {amount}
      </Typography>
      {[
        formatMeasurementDate(expense.takenAt),
        names.link(expense),
        expense.description,
      ]
        .filter((line): line is string => Boolean(line))
        .map(line => (
          <Typography
            key={line}
            component="span"
            variant="caption"
            noWrap
            sx={{ display: 'block', color: 'text.secondary' }}
          >
            {line}
          </Typography>
        ))}
    </ButtonBase>
  )
}

function ExpensesScreen() {
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const role = useSessionStore(selectActiveRole)
  const canWrite = canWriteFleet(role)
  const expenses = useExpensesStore()
  const loadFleet = useFleetStore(state => state.load)
  const names = useCurrentNames()
  const [pickerIsOpen, setPickerIsOpen] = useState(false)
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [kind, setKind] = useState<ExpenseKind | null>(null)
  const [truckId, setTruckId] = useState<string | null>(null)
  const { load, loadCategories } = expenses

  useEffect(() => {
    if (!orgId) return
    void load(orgId)
    void loadCategories(orgId)
    void loadFleet(orgId)
  }, [orgId, load, loadCategories, loadFleet])

  const period = expensesPeriodOf(expenses)
  const periodText = formatPeriod(period)

  const options = useMemo(
    () => ({
      categories: optionsOf(
        expenses.items.map(expense => [
          expense.categoryId,
          names.category(expense.categoryId) ?? expense.categoryName,
        ])
      ),
      // A trip's expenses carry its truck: they count for it (RF-9)
      trucks: optionsOf(
        expenses.items.flatMap(expense =>
          expense.truckId && expense.truckName
            ? [[expense.truckId, expense.truckName] as [string, string]]
            : []
        )
      ),
    }),
    [expenses.items, names]
  )

  const shown = expenses.items.filter(
    expense =>
      (categoryId === null || expense.categoryId === categoryId) &&
      (kind === null || expense.kind === kind) &&
      (truckId === null || expense.truckId === truckId)
  )
  const filtered = categoryId !== null || kind !== null || truckId !== null
  const total = totalsByCurrency(shown)
  const byCategory = totalsByCategory(shown, names.category)

  const clearFilters = () => {
    setCategoryId(null)
    setKind(null)
    setTruckId(null)
  }

  const renderList = () => {
    if (expenses.status === 'error' && expenses.items.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<CloudOffIcon />}
          title="No pudimos cargar los gastos"
          description={RETRY_HINT}
          action={{ label: 'Reintentar', onClick: () => void load(orgId) }}
        />
      )
    }
    if (expenses.status !== 'ready' && expenses.items.length === 0) {
      return (
        <Stack spacing={2} aria-busy="true" aria-label="Cargando gastos">
          {[0, 1, 2].map(index => (
            <Skeleton
              key={index}
              variant="rounded"
              height={104}
              sx={{ borderRadius: `${String(radius.lg)}px` }}
            />
          ))}
        </Stack>
      )
    }
    if (expenses.items.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<ReceiptLongIcon />}
          title="No hay gastos en este periodo"
          description={
            canWrite
              ? 'Agrega un gasto o elige otro periodo.'
              : 'Elige otro periodo.'
          }
          {...(canWrite && {
            action: {
              label: 'Agregar gasto',
              onClick: () => {
                navigate('/gastos/nuevo')
              },
            },
          })}
        />
      )
    }
    if (shown.length === 0) {
      return (
        <EmptyState
          headingLevel="h2"
          icon={<SearchOffIcon />}
          title="Sin resultados"
          description="Ningún gasto del periodo cumple los filtros."
          action={{ label: 'Quitar filtros', onClick: clearFilters }}
        />
      )
    }
    return (
      <Stack
        component="ul"
        spacing={2}
        aria-label="Gastos"
        sx={{ listStyle: 'none', m: 0, p: 0 }}
      >
        {shown.map(expense => (
          <li key={expense.id}>
            <ExpenseCard
              expense={expense}
              names={names}
              onClick={() => {
                navigate(`/gastos/${expense.id}`)
              }}
            />
          </li>
        ))}
      </Stack>
    )
  }

  return (
    <Box
      component="main"
      sx={{
        minHeight: `calc(100dvh - ${String(layout.appBarHeight)}px)`,
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      <Box sx={{ px: 4, pt: 2, pb: 4, flexGrow: 1 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 4 }}>
          <Typography variant="h3" component="h1" sx={{ flexGrow: 1 }}>
            Gastos
          </Typography>
          {/* Text only: with "Agregar" it fits one row at 375 px (RNF-3) */}
          <Button
            onClick={() => {
              navigate('/gastos/categorias')
            }}
          >
            Categorías
          </Button>
          {canWrite && (
            <Button
              variant="contained"
              startIcon={<AddIcon />}
              onClick={() => {
                navigate('/gastos/nuevo')
              }}
            >
              Agregar
            </Button>
          )}
        </Box>

        <Typography
          variant="overline"
          component="p"
          sx={{ color: 'text.secondary', mb: 1 }}
        >
          Periodo
        </Typography>
        <Button
          variant="outlined"
          fullWidth
          startIcon={<CalendarMonthIcon />}
          onClick={() => {
            setPickerIsOpen(true)
          }}
          aria-label={`Periodo: ${periodText}. Cambiar`}
          sx={{ justifyContent: 'flex-start', mb: 3 }}
        >
          {periodText}
        </Button>

        {/* One row of chips (specs/0017), with what the period has */}
        <Box sx={{ mb: 3 }}>
          <FilterBar>
            {options.categories.length > 1 && (
              <FilterChip
                label="Categoría"
                allLabel="Todas"
                options={options.categories}
                value={categoryId}
                onChange={setCategoryId}
              />
            )}
            <FilterChip
              label="Corresponde a"
              allLabel="Todos"
              options={KIND_OPTIONS}
              value={kind}
              onChange={setKind}
            />
            {options.trucks.length > 1 && (
              <FilterChip
                label="Camión"
                allLabel="Todos"
                options={options.trucks}
                value={truckId}
                onChange={setTruckId}
              />
            )}
          </FilterBar>
        </Box>

        {expenses.items.length > 0 && (
          <Box
            role="status"
            aria-label={
              filtered ? 'Totales de lo filtrado' : 'Totales del periodo'
            }
            sx={{
              mb: 4,
              px: 4,
              py: 3,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              borderRadius: `${String(radius.lg)}px`,
            }}
          >
            <Typography variant="body2">
              {shown.length === 1
                ? '1 gasto'
                : `${String(shown.length)} gastos`}
              {total.length > 0 &&
                ` · ${total
                  .map(item => moneyTotal(item.currency, item.amount))
                  .join(' · ')}`}
            </Typography>
            {byCategory.length > 0 && (
              <Box
                component="dl"
                sx={{
                  m: 0,
                  mt: 2,
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  columnGap: 3,
                  rowGap: 0.5,
                }}
              >
                {byCategory.map(item => (
                  <Box
                    key={`${item.name}|${item.currency}`}
                    sx={{ display: 'contents' }}
                  >
                    <Typography
                      component="dt"
                      variant="caption"
                      noWrap
                      sx={{ color: 'text.secondary' }}
                    >
                      {item.name}
                    </Typography>
                    <Typography
                      component="dd"
                      variant="caption"
                      sx={{ m: 0, textAlign: 'right' }}
                    >
                      {moneyTotal(item.currency, item.amount)}
                    </Typography>
                  </Box>
                ))}
              </Box>
            )}
          </Box>
        )}

        {expenses.truncated && (
          <Alert severity="info" sx={{ mb: 4 }}>
            Mostramos los 1000 más recientes. Elige un periodo más corto.
          </Alert>
        )}

        {renderList()}
      </Box>
      <NavBar />

      {pickerIsOpen && (
        <Suspense fallback={null}>
          <DateModal
            initialRange={{ startDate: period.start, endDate: period.end }}
            onSelect={({ startDate, endDate }) =>
              void expenses.choosePeriod({ start: startDate, end: endDate })
            }
            onClose={() => {
              setPickerIsOpen(false)
            }}
          />
        </Suspense>
      )}
    </Box>
  )
}

export default function Expenses() {
  return (
    <SessionGate needs="ready">
      <ExpensesScreen />
    </SessionGate>
  )
}
