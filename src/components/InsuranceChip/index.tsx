import Chip from '@mui/material/Chip'
import type { InsuranceNotice } from 'utils/insurance'

/**
 * The insurance notice (backend specs/0011 RF-4): quiet in the month
 * before, in the error color in the last week and once expired.
 */
export default function InsuranceChip({ notice }: { notice: InsuranceNotice }) {
  return (
    <Chip
      label={notice.text}
      size="small"
      color={notice.urgent ? 'error' : 'default'}
      variant={notice.urgent ? 'filled' : 'outlined'}
      sx={{ alignSelf: 'flex-start' }}
    />
  )
}
