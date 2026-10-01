import Tab from '@mui/material/Tab'
import Tabs from '@mui/material/Tabs'

export type HistoryTab = 'measurements' | 'refuels'

/** Historial → "Mediciones / Rellenos" (backend specs/0006 RF-7). */
export default function HistoryTabs({
  tab,
  onChange,
}: {
  tab: HistoryTab
  onChange: (tab: HistoryTab) => void
}) {
  return (
    <Tabs
      value={tab}
      variant="fullWidth"
      aria-label="Qué ver"
      onChange={(_, value: HistoryTab) => {
        onChange(value)
      }}
      sx={{ mb: 4 }}
    >
      <Tab value="measurements" label="Mediciones" />
      <Tab value="refuels" label="Rellenos" />
    </Tabs>
  )
}
