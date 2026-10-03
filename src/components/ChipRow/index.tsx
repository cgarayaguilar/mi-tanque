import Box from '@mui/material/Box'
import Chip from '@mui/material/Chip'
import Typography from '@mui/material/Typography'

/**
 * A row of chips, one chosen at most: "Todas" means no filter (backend
 * specs/0014 RF-3). It slides sideways on a phone; the page does not.
 */
export default function ChipRow<T extends string | number>({
  label,
  allLabel,
  options,
  value,
  onChange,
}: {
  label: string
  allLabel: string
  options: readonly { value: T; label: string }[]
  value: T | null
  onChange: (value: T | null) => void
}) {
  const chip = (
    key: string,
    text: string,
    pressed: boolean,
    next: T | null
  ) => (
    <Chip
      key={key}
      label={text}
      clickable
      variant={pressed ? 'filled' : 'outlined'}
      color={pressed ? 'primary' : 'default'}
      aria-pressed={pressed}
      onClick={() => {
        onChange(next)
      }}
      sx={{ flexShrink: 0 }}
    />
  )
  return (
    // minWidth 0: a grid item grows to its chips otherwise, and the whole
    // page (or dialog) scrolled sideways instead of the row
    <Box role="group" aria-label={label} sx={{ minWidth: 0 }}>
      <Typography
        variant="overline"
        component="p"
        sx={{ color: 'text.secondary' }}
      >
        {label}
      </Typography>
      {/* One line that slides sideways on a phone (specs/0014 RF-3) */}
      <Box
        sx={{
          display: 'flex',
          gap: 1,
          overflowX: 'auto',
          pb: 1,
          scrollbarWidth: 'none',
        }}
      >
        {chip('all', allLabel, value === null, null)}
        {options.map(option =>
          chip(
            String(option.value),
            option.label,
            value === option.value,
            value === option.value ? null : option.value
          )
        )}
      </Box>
    </Box>
  )
}
