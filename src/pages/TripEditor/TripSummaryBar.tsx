import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Typography from '@mui/material/Typography'
import type { Currency } from 'schemas/account'
import { toCents } from 'schemas/trips'
import { space } from 'theme/tokens'
import { moneyTotal } from 'utils/formatMoney'

interface TripSummaryBarProps {
  income: number
  expenses: number
  currency: Currency
  /** The form it saves. */
  formId: string
  saveLabel: string
  saving: boolean
}

/**
 * Fixed at the foot of the trip's form (backend specs/0029 RF-6): what the
 * trip leaves and its save button, at hand while it is filled. Sticky, so it
 * never covers the last field: its place is kept at the end of the form.
 */
export default function TripSummaryBar({
  income,
  expenses,
  currency,
  formId,
  saveLabel,
  saving,
}: TripSummaryBarProps) {
  const profit = toCents(income - expenses)
  // A figure of the bar: its name, then its amount on its own (RNF-2: a long
  // amount wraps alone, never past the screen)
  const figure = (label: string, amount: number, strong = false) => (
    <Box sx={{ minWidth: 0 }}>
      <Typography
        component="dt"
        variant="caption"
        sx={{ display: 'inline', color: 'text.secondary' }}
      >
        {label}{' '}
      </Typography>
      <Typography
        component="dd"
        variant={strong ? 'subtitle2' : 'caption'}
        sx={{
          display: strong ? 'block' : 'inline',
          m: 0,
          overflowWrap: 'anywhere',
          ...(amount < 0 && strong && { color: 'error.main' }),
        }}
      >
        {moneyTotal(currency, amount)}
      </Typography>
    </Box>
  )
  return (
    <Box
      role="region"
      aria-label="Resumen del viaje"
      sx={{
        position: 'sticky',
        bottom: 0,
        zIndex: 1,
        mx: -4,
        px: 4,
        pt: 2,
        pb: `calc(${String(space.base)}px + env(safe-area-inset-bottom))`,
        bgcolor: 'background.default',
        borderTop: 1,
        borderColor: 'divider',
      }}
    >
      <Box
        component="dl"
        sx={{ display: 'flex', flexWrap: 'wrap', columnGap: 3, m: 0, mb: 2 }}
      >
        {figure('Ingresos', income)}
        {figure('Gastos', expenses)}
      </Box>
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          alignItems: 'center',
          gap: 3,
        }}
      >
        <Box component="dl" sx={{ m: 0, minWidth: 0 }}>
          {figure('Utilidad', profit, true)}
        </Box>
        <Button
          type="submit"
          form={formId}
          variant="contained"
          size="large"
          loading={saving}
          loadingPosition="start"
        >
          {saveLabel}
        </Button>
      </Box>
    </Box>
  )
}
