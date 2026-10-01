import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { levelText, money } from 'components/RefuelForm'
import { radius } from 'theme/tokens'
import type { RefuelValues } from 'types'
import { formatNumber } from 'utils/formatNumber'

/** What a saved refuel changed (backend specs/0006 RF-4). */
export default function RefuelSummary({ values }: { values: RefuelValues }) {
  return (
    <Box
      role="status"
      sx={{
        mt: 4,
        px: 4,
        py: 3,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.lg)}px`,
      }}
    >
      <Typography variant="subtitle2" component="p">
        Antes {levelText(values.gallonsBefore, values.fillPercentBefore)} →
        Después {levelText(values.gallonsAfter, values.fillPercentAfter)}
      </Typography>
      <Typography variant="caption" sx={{ color: 'text.secondary' }}>
        {formatNumber(values.gallonsAdded, 2)} gal (
        {formatNumber(values.litersAdded, 2)} L) ·{' '}
        {money(values.currency, values.total)}
      </Typography>
    </Box>
  )
}
