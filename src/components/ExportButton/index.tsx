import { useRef, useState } from 'react'
import { sileo } from 'sileo'
import Button from '@mui/material/Button'
import FileDownloadIcon from '@mui/icons-material/FileDownload'
// Types only: the export code (CSV, file) loads with import() when used
import type { ExportKind, ExportResult } from 'utils/exportFile'
import { formatNumber } from 'utils/formatNumber'
import { reportError } from 'utils/reportError'

const NOUNS: Record<ExportKind, { one: string; many: string; the: string }> = {
  measurements: { one: '1 medición', many: 'mediciones', the: 'las' },
  refuels: { one: '1 relleno', many: 'rellenos', the: 'los' },
}

/**
 * "Exportar" in Historial (backend specs/0007 RF-1, RF-9): downloads the tab
 * being viewed; `run` loads its export service with import().
 */
export default function ExportButton({
  kind,
  run,
}: {
  kind: ExportKind
  run: () => Promise<ExportResult>
}) {
  const [busy, setBusy] = useState(false)
  const busyRef = useRef(false)
  const noun = NOUNS[kind]

  const exportNow = async () => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    try {
      const { count, truncated } = await run()
      if (count === 0) {
        sileo.warning({ title: `No hay ${noun.many} en este periodo` })
      } else if (truncated) {
        sileo.warning({
          title: `Exportamos ${noun.the} ${formatNumber(count)} ${noun.many} más recientes`,
          description: 'Acorta el periodo para exportar el resto.',
        })
      } else {
        sileo.success({
          title: `Exportamos ${count === 1 ? noun.one : `${formatNumber(count)} ${noun.many}`}`,
        })
      }
    } catch (error) {
      // By name: the error class lives in the lazily loaded export code
      if (error instanceof Error && error.name === 'ExportOfflineError') {
        sileo.warning({
          title: 'Necesitas conexión para exportar',
          description: 'Así el archivo trae todo el periodo.',
        })
        return
      }
      reportError(error, { operation: 'exportHistory', kind })
      sileo.action({
        title: 'No pudimos exportar',
        description: 'Revisa tu conexión y vuelve a intentarlo.',
        button: { title: 'Reintentar', onClick: () => void exportNow() },
      })
    } finally {
      busyRef.current = false
      setBusy(false)
    }
  }

  return (
    <Button
      variant="outlined"
      startIcon={<FileDownloadIcon />}
      loading={busy}
      loadingPosition="start"
      aria-label={`Exportar ${noun.many} del periodo`}
      onClick={() => void exportNow()}
      sx={{ flexShrink: 0 }}
    >
      Exportar
    </Button>
  )
}
