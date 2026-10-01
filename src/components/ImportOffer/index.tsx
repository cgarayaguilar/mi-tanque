import { useEffect, useState } from 'react'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import {
  importOfferAnswered,
  rememberImportOffer,
  useImportLocalData,
} from 'hooks/useImportLocalData'
import { countMeasurements } from 'services/measurements'
import { selectActiveRole, useSessionStore } from 'store/session'
import { reportError } from 'utils/reportError'
import { canWriteFleet } from 'utils/roles'

/**
 * Offers, once per organization, to bring the basic mode's measurements
 * (backend specs/0004 RF-15). Mi cuenta keeps the same action for later.
 */
export default function ImportOffer() {
  const orgId = useSessionStore(state => state.organization?.id ?? null)
  const orgName = useSessionStore(state => state.organization?.name ?? '')
  const role = useSessionStore(selectActiveRole)
  // Keyed by organization: switching never shows the previous one's offer
  const [offer, setOffer] = useState<{ orgId: string; count: number } | null>(
    null
  )
  const { importing, run } = useImportLocalData()

  useEffect(() => {
    if (!orgId || !canWriteFleet(role) || importOfferAnswered(orgId)) return
    let active = true
    countMeasurements()
      .then(total => {
        if (active) setOffer({ orgId, count: total })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'countLocalMeasurements' })
      })
    return () => {
      active = false
    }
  }, [orgId, role])

  const count = offer?.orgId === orgId ? offer.count : 0
  if (!orgId || count === 0) return null

  const dismiss = () => {
    rememberImportOffer(orgId, 'dismissed')
    setOffer(null)
  }

  return (
    <Dialog
      open
      onClose={importing ? undefined : dismiss}
      aria-labelledby="import-offer-title"
      aria-describedby="import-offer-description"
    >
      <DialogTitle id="import-offer-title">
        ¿Pasamos tus mediciones a {orgName}?
      </DialogTitle>
      <DialogContent>
        <DialogContentText id="import-offer-description">
          Este teléfono tiene{' '}
          {count === 1 ? '1 medición' : `${String(count)} mediciones`} de cuando
          usabas la app sin cuenta. Las importamos con sus tanques y aquí no se
          borran. También puedes hacerlo después desde Mi cuenta.
        </DialogContentText>
      </DialogContent>
      <DialogActions>
        <Button onClick={dismiss} disabled={importing}>
          Ahora no
        </Button>
        <Button
          variant="contained"
          loading={importing}
          onClick={() => {
            void run().then(done => {
              if (done) setOffer(null)
            })
          }}
        >
          Importar
        </Button>
      </DialogActions>
    </Dialog>
  )
}
