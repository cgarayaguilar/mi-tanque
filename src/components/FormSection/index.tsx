import { useId, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { radius, space } from 'theme/tokens'

interface FormSectionProps {
  /** Its place in the form: 1, 2, 3… */
  number: number
  title: string
  /** What it is for: "¿Con qué y con quién?" */
  hint?: string
  /** A button at the right of its title, as "+ Agregar". */
  action?: ReactNode
  /** How many of its fields failed to save: "1 dato por revisar". */
  issues?: number
  /** To go to it when it is the first with something to fix. */
  id?: string
  children: ReactNode
}

/** "1 dato por revisar", "2 datos por revisar". */
export const issuesText = (issues: number) =>
  `${String(issues)} ${issues === 1 ? 'dato' : 'datos'} por revisar`

/**
 * A numbered card of a long form, with its title and what it is for
 * (backend specs/0029 RF-1, RF-2).
 */
export default function FormSection({
  number,
  title,
  hint,
  action,
  issues = 0,
  id,
  children,
}: FormSectionProps) {
  const titleId = useId()
  return (
    <Box
      component="section"
      id={id}
      aria-labelledby={titleId}
      sx={{
        p: 4,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: issues > 0 ? 'error.main' : 'divider',
        borderRadius: `${String(radius.lg)}px`,
        // Under the app bar when the form takes the user here
        scrollMarginTop: `${String(space.base)}px`,
      }}
    >
      {/* Number, title and action on one row; under them, from the title
          to the edge, what it is for and what to fix */}
      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: 'auto minmax(0, 1fr) auto',
          alignItems: 'center',
          columnGap: 3,
          mb: 5,
        }}
      >
        <Box
          aria-hidden
          sx={{
            display: 'grid',
            placeItems: 'center',
            width: theme => theme.spacing(7),
            height: theme => theme.spacing(7),
            borderRadius: `${String(radius.pill)}px`,
            bgcolor: 'action.selected',
            typography: 'subtitle2',
          }}
        >
          {number}
        </Box>
        <Typography id={titleId} variant="h6" component="h2">
          {title}
        </Typography>
        <Box sx={{ mr: -2 }}>{action}</Box>
        {hint && (
          <Typography
            variant="body2"
            sx={{ gridColumn: '2 / 4', color: 'text.secondary' }}
          >
            {hint}
          </Typography>
        )}
        {issues > 0 && (
          <Typography
            variant="subtitle2"
            role="status"
            sx={{ gridColumn: '2 / 4', color: 'error.main' }}
          >
            {issuesText(issues)}
          </Typography>
        )}
      </Box>
      <Stack spacing={5}>{children}</Stack>
    </Box>
  )
}
