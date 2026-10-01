import type { ReactNode } from 'react'
import Button from '@mui/material/Button'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { colorTokens } from 'theme/tokens'

interface EmptyStateProps {
  icon: ReactNode
  title: string
  description: string
  action: { label: string; onClick: () => void }
  /** h1 when the state is the whole screen; h2 inside a page with its own title. */
  headingLevel?: 'h1' | 'h2'
}

/** Empty or onboarding state (§8.2): muted icon, clear message, primary CTA. */
export default function EmptyState({
  icon,
  title,
  description,
  action,
  headingLevel = 'h1',
}: EmptyStateProps) {
  return (
    <Stack
      spacing={3}
      sx={{ alignItems: 'center', textAlign: 'center', py: 12, px: 4 }}
    >
      <Stack
        aria-hidden="true"
        sx={{
          color: 'text.secondary',
          bgcolor: theme => colorTokens[theme.palette.mode].surfaceStrong,
          borderRadius: '50%',
          p: 4,
          '& svg': { fontSize: 32 },
        }}
      >
        {icon}
      </Stack>
      <Typography variant="h3" component={headingLevel}>
        {title}
      </Typography>
      <Typography variant="body1" sx={{ maxWidth: '36ch' }}>
        {description}
      </Typography>
      <Button variant="contained" size="large" onClick={action.onClick}>
        {action.label}
      </Button>
    </Stack>
  )
}
