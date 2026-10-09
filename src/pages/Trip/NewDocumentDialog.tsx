import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogTitle from '@mui/material/DialogTitle'
import LinearProgress from '@mui/material/LinearProgress'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import TextField from 'components/TextField'
import {
  documentNameSchema,
  fileSizeText,
  TRIP_DOCUMENT_LIMITS,
  type DocumentNameValues,
  type TripDocument,
} from 'schemas/tripDocuments'
import {
  newTripDocumentId,
  PHOTO_TOO_BIG,
  uploadTripDocument,
} from 'services/tripDocuments'
import { recoverFromLostPermission } from 'store/session'
import { reportError } from 'utils/reportError'
import { radius } from 'theme/tokens'

const FORM_ID = 'trip-document'
export const OFFLINE_UPLOAD = 'Necesitas conexión para subir el documento.'

interface NewDocumentDialogProps {
  file: File
  kind: 'photo' | 'pdf'
  /** A photo's address on the phone, to see it before uploading it. */
  preview: string | null
  defaultName: string
  orgId: string
  tripId: string
  onUploaded: (document: TripDocument) => void
  onClose: () => void
}

const isDenied = (error: unknown) => {
  const code = (error as { code?: unknown } | null)?.code
  return code === 'storage/unauthorized' || code === 'permission-denied'
}

/** "Nuevo documento" (backend specs/0037 RF-10): its preview and its name. */
export default function NewDocumentDialog({
  file,
  kind,
  preview,
  defaultName,
  orgId,
  tripId,
  onUploaded,
  onClose,
}: NewDocumentDialogProps) {
  const [id] = useState(newTripDocumentId)
  const [progress, setProgress] = useState<number | null>(null)
  const uploading = progress !== null
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentNameValues>({
    resolver: zodResolver(documentNameSchema),
    defaultValues: { name: defaultName },
  })

  const upload = async ({ name }: DocumentNameValues) => {
    if (!navigator.onLine) {
      sileo.warning({ title: OFFLINE_UPLOAD })
      return
    }
    setProgress(0)
    try {
      const document = await uploadTripDocument(
        { orgId, tripId, id, name, file, kind },
        setProgress
      )
      sileo.success({ title: 'Documento subido' })
      onUploaded(document)
      onClose()
    } catch (error) {
      reportError(error, { operation: 'uploadTripDocument', kind })
      setProgress(null)
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: 'No pudimos subir el documento',
        description:
          error instanceof Error && error.message === PHOTO_TOO_BIG
            ? 'La foto pesa demasiado. Tómala de nuevo con menos detalle.'
            : isDenied(error)
              ? 'No tienes permiso para subirlo. Si el problema sigue, avísanos.'
              : 'Revisa tu conexión y vuelve a intentarlo.',
      })
    }
  }

  return (
    <Dialog
      open
      onClose={() => {
        if (!uploading) onClose()
      }}
      aria-labelledby={`${FORM_ID}-title`}
      fullWidth
      scroll="paper"
    >
      <DialogTitle id={`${FORM_ID}-title`}>Nuevo documento</DialogTitle>
      <DialogContent>
        <Stack
          component="form"
          id={FORM_ID}
          noValidate
          aria-label="Nuevo documento"
          spacing={6}
          onSubmit={event => {
            void handleSubmit(upload)(event)
          }}
          sx={{ pt: 2 }}
        >
          {kind === 'photo' ? (
            preview && (
              <Box
                component="img"
                src={preview}
                alt="Vista previa"
                sx={{
                  width: '100%',
                  maxHeight: 240,
                  objectFit: 'contain',
                  borderRadius: `${String(radius.lg)}px`,
                  bgcolor: 'action.hover',
                }}
              />
            )
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 3 }}>
              <PictureAsPdfOutlinedIcon
                fontSize="large"
                sx={{ color: 'error.main' }}
              />
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ overflowWrap: 'anywhere' }}>
                  {file.name}
                </Typography>
                <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                  {fileSizeText(file.size)}
                </Typography>
              </Box>
            </Box>
          )}
          <TextField
            id="tripDocumentName"
            label="Nombre"
            placeholder="Carta de porte"
            maxLength={TRIP_DOCUMENT_LIMITS.name}
            error={errors.name?.message}
            registration={register('name')}
            disabled={uploading}
          />
          {uploading && (
            <LinearProgress
              variant="determinate"
              value={Math.round(progress * 100)}
              aria-label="Subiendo el documento"
            />
          )}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={uploading}>
          Cancelar
        </Button>
        <Button
          type="submit"
          form={FORM_ID}
          variant="contained"
          loading={uploading}
        >
          Subir
        </Button>
      </DialogActions>
    </Dialog>
  )
}
