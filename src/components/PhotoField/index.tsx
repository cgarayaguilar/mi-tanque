import { useEffect, useId, useRef, useState } from 'react'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Skeleton from '@mui/material/Skeleton'
import Typography from '@mui/material/Typography'
import AddAPhotoIcon from '@mui/icons-material/AddAPhoto'
import { useOnlineStatus } from 'hooks/useOnlineStatus'
import { radius } from 'theme/tokens'
import { reportError } from 'utils/reportError'

interface PhotoFieldProps {
  /** Alt text of the photo, e.g. "Foto de Unidad 12". */
  alt: string
  /** Its title; "Foto" for an item of the fleet. */
  label?: string
  path: string | null
  /** Resolves the stored path to a URL (services/fleet). */
  loadUrl: (path: string) => Promise<string>
  /**
   * Compresses and uploads; resolves with the new path and URL. Without it
   * the photo is only shown (a refuel's invoice on its expense, specs/0027).
   */
  upload?: (file: File) => Promise<{ path: string; url: string }>
  onUploaded?: (path: string) => void
  disabled?: boolean
}

/** The item's single photo (specs/0003 RF-13): shown, added or replaced. */
export default function PhotoField({
  alt,
  label = 'Foto',
  path,
  loadUrl,
  upload,
  onUploaded,
  disabled = false,
}: PhotoFieldProps) {
  const online = useOnlineStatus()
  const inputId = useId()
  const inputRef = useRef<HTMLInputElement>(null)
  const [url, setUrl] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!path) return
    let cancelled = false
    loadUrl(path).then(
      found => {
        if (!cancelled) setUrl(found)
      },
      (error: unknown) => {
        // The rest of the form still works; the photo just does not show
        reportError(error, { operation: 'loadFleetPhoto' })
      }
    )
    return () => {
      cancelled = true
    }
  }, [path, loadUrl])

  const choose = async (file: File | undefined) => {
    if (!file || !upload) return
    // Without signal the upload retries for minutes with the spinner on
    // (audit 2026-10-01): a photo needs a connection, so say it now
    if (!navigator.onLine) {
      sileo.warning({
        title: 'Necesitas conexión para subir la foto',
        description: 'Vuelve a intentarlo cuando tengas señal.',
      })
      if (inputRef.current) inputRef.current.value = ''
      return
    }
    setBusy(true)
    try {
      const result = await upload(file)
      setUrl(result.url)
      onUploaded?.(result.path)
      sileo.success({ title: 'Foto guardada' })
    } catch (error) {
      reportError(error, { operation: 'uploadFleetPhoto' })
      sileo.error({
        title: 'No pudimos subir la foto',
        description: 'Revisa tu conexión y vuelve a intentarlo.',
      })
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ''
    }
  }

  return (
    <Box>
      <Typography variant="subtitle2" component="p" sx={{ mb: 2 }}>
        {label}
      </Typography>
      {path && !url ? (
        <Skeleton
          variant="rounded"
          sx={{
            aspectRatio: '4 / 3',
            height: 'auto',
            borderRadius: `${String(radius.lg)}px`,
          }}
        />
      ) : (
        url && (
          <Box
            component="img"
            src={url}
            alt={alt}
            sx={{
              display: 'block',
              width: '100%',
              aspectRatio: '4 / 3',
              objectFit: 'cover',
              borderRadius: `${String(radius.lg)}px`,
              border: 1,
              borderColor: 'divider',
            }}
          />
        )
      )}
      {upload && (
        <>
          <input
            ref={inputRef}
            id={inputId}
            type="file"
            accept="image/*"
            hidden
            onChange={event => void choose(event.target.files?.[0])}
          />
          <Button
            variant="outlined"
            startIcon={<AddAPhotoIcon />}
            loading={busy}
            loadingPosition="start"
            disabled={disabled || !online}
            onClick={() => inputRef.current?.click()}
            sx={{ mt: 2 }}
          >
            {path ? 'Cambiar foto' : 'Agregar foto'}
          </Button>
          {!online && (
            <Typography
              variant="caption"
              component="p"
              sx={{ mt: 1, color: 'text.secondary' }}
            >
              Necesitas conexión para subir la foto.
            </Typography>
          )}
        </>
      )}
    </Box>
  )
}
