import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'

export type MeasureMode = 'measure' | 'refuel'

/** "Medir / Rellenar" in Medición (backend specs/0006 RF-1). */
export default function ModeToggle({
  mode,
  onChange,
}: {
  mode: MeasureMode
  onChange: (mode: MeasureMode) => void
}) {
  return (
    <ToggleButtonGroup
      exclusive
      fullWidth
      size="small"
      value={mode}
      aria-label="Qué quieres registrar"
      onChange={(_, value: MeasureMode | null) => {
        if (value) onChange(value)
      }}
      sx={{ mb: 4 }}
    >
      <ToggleButton value="measure">Medir</ToggleButton>
      <ToggleButton value="refuel">Rellenar</ToggleButton>
    </ToggleButtonGroup>
  )
}
