import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import { typeScale } from 'theme/tokens'

interface StatProps {
  label: string
  value: string | number
  caption?: string
  size?: 'small' | 'medium'
}

/** A labelled figure: uppercase label, tabular-digit value, optional caption. */
export default function Stat({
  label,
  value,
  caption,
  size = 'medium',
}: StatProps) {
  return (
    <Box>
      <Typography
        component="p"
        variant="overline"
        sx={{ color: 'text.secondary', display: 'block', mb: 1 }}
      >
        {label}
      </Typography>
      <Typography
        component="p"
        sx={{
          ...(size === 'small' ? typeScale.figureSm : typeScale.figureMd),
          color: 'text.primary',
        }}
      >
        {value}
      </Typography>
      {caption !== undefined && (
        <Typography variant="caption" sx={{ color: 'text.secondary' }}>
          {caption}
        </Typography>
      )}
    </Box>
  )
}
