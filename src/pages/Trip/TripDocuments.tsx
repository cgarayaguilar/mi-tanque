import { useEffect, useRef, useState, type ChangeEvent } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { format } from 'date-fns'
import { es } from 'date-fns/locale'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Dialog from '@mui/material/Dialog'
import IconButton from '@mui/material/IconButton'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import CloseIcon from '@mui/icons-material/Close'
import PhotoCameraOutlinedIcon from '@mui/icons-material/PhotoCameraOutlined'
import PictureAsPdfOutlinedIcon from '@mui/icons-material/PictureAsPdfOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import CreateDialog from 'components/CreateDialogs/CreateDialog'
import RowCard from 'components/RowCard'
import TextField from 'components/TextField'
import type { TripDocumentsState } from 'hooks/useTripDocuments'
import {
  canManageDocument,
  defaultDocumentName,
  documentNameSchema,
  fileIssue,
  fileKindOf,
  fileSizeText,
  TRIP_DOCUMENT_LIMITS,
  type DocumentNameValues,
  type TripDocument,
} from 'schemas/tripDocuments'
import { photoUrl } from 'services/fleet'
import { deleteTripDocument, renameTripDocument } from 'services/tripDocuments'
import { recoverFromLostPermission } from 'store/session'
import { radius } from 'theme/tokens'
import { reportError } from 'utils/reportError'
import type { Role } from 'utils/roles'
import { RETRY_HINT } from 'utils/withTimeout'
import NewDocumentDialog, { OFFLINE_UPLOAD } from './NewDocumentDialog'

const THUMB = 48

/** The download address of a file, once known; null while it is read. */
const useFileUrl = (path: string) => {
  const [url, setUrl] = useState<{ path: string; url: string } | null>(null)
  useEffect(() => {
    let current = true
    photoUrl(path)
      .then(value => {
        if (current) setUrl({ path, url: value })
      })
      .catch((error: unknown) => {
        reportError(error, { operation: 'loadTripDocument' })
      })
    return () => {
      current = false
    }
  }, [path])
  return url?.path === path ? url.url : null
}

function Thumbnail({
  document,
  url,
}: {
  document: TripDocument
  url: string | null
}) {
  const frame = {
    width: THUMB,
    height: THUMB,
    borderRadius: `${String(radius.md)}px`,
    bgcolor: 'action.hover',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  } as const
  if (document.contentType === 'application/pdf')
    return (
      <Box component="span" sx={frame}>
        <PictureAsPdfOutlinedIcon sx={{ color: 'error.main' }} />
      </Box>
    )
  return url ? (
    <Box
      component="img"
      src={url}
      alt=""
      sx={{ ...frame, objectFit: 'cover' }}
    />
  ) : (
    <Skeleton variant="rounded" width={THUMB} height={THUMB} />
  )
}

interface DocumentCardProps {
  document: TripDocument
  author: string | null
  canManage: boolean
  onOpen: (url: string) => void
  onRename: () => void
  onDelete: () => void
}

function DocumentCard({
  document,
  author,
  canManage,
  onOpen,
  onRename,
  onDelete,
}: DocumentCardProps) {
  const url = useFileUrl(document.path)
  const isPdf = document.contentType === 'application/pdf'
  // Two lines: at 375 px one cut off the size
  const lines = [
    author ? `Subido por ${author}` : null,
    [
      document.createdAt
        ? format(document.createdAt, 'd MMM yyyy, HH:mm', { locale: es })
        : null,
      fileSizeText(document.size),
    ]
      .filter(Boolean)
      .join(' · '),
  ]
  return (
    <RowCard
      label={`${isPdf ? 'PDF' : 'Foto'}: ${document.name}`}
      title={document.name}
      lines={lines}
      leading={<Thumbnail document={document} url={url} />}
      // A PDF opens in the phone's viewer, in another tab; as a link, so
      // the browser does not block it (RF-12)
      href={isPdf && url ? url : undefined}
      onClick={
        !isPdf && url
          ? () => {
              onOpen(url)
            }
          : undefined
      }
      {...(canManage && {
        actions: [{ label: 'Renombrar', onClick: onRename }],
        removal: {
          menuLabel: `Opciones del documento ${document.name}`,
          title: `¿Borrar ${document.name}?`,
          description: 'Se borra para todos. No se puede deshacer.',
          actionLabel: 'Borrar',
          onRemove: onDelete,
        },
      })}
    />
  )
}

function RenameDialog({
  document,
  onRenamed,
  onClose,
}: {
  document: TripDocument
  onRenamed: (name: string) => void
  onClose: () => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DocumentNameValues>({
    resolver: zodResolver(documentNameSchema),
    defaultValues: { name: document.name },
  })
  return (
    <CreateDialog
      title="Renombrar documento"
      formId="trip-document-name"
      saveLabel="Guardar"
      onSubmit={event => {
        void handleSubmit(({ name }) => {
          onRenamed(name)
          onClose()
        })(event)
      }}
      onClose={onClose}
    >
      <TextField
        id="tripDocumentNewName"
        label="Nombre"
        maxLength={TRIP_DOCUMENT_LIMITS.name}
        error={errors.name?.message}
        registration={register('name')}
      />
    </CreateDialog>
  )
}

function PhotoViewer({
  url,
  name,
  onClose,
}: {
  url: string
  name: string
  onClose: () => void
}) {
  return (
    <Dialog
      open
      fullScreen
      onClose={onClose}
      aria-labelledby="trip-document-viewer-title"
      slotProps={{ paper: { sx: { bgcolor: 'common.black' } } }}
    >
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          px: 2,
          py: 1,
          color: 'common.white',
        }}
      >
        <Typography
          id="trip-document-viewer-title"
          variant="subtitle1"
          noWrap
          sx={{ flexGrow: 1 }}
        >
          {name}
        </Typography>
        <IconButton
          aria-label="Cerrar"
          onClick={onClose}
          sx={{ color: 'common.white' }}
        >
          <CloseIcon />
        </IconButton>
      </Box>
      <Box
        component="img"
        src={url}
        alt={name}
        sx={{ flexGrow: 1, minHeight: 0, width: '100%', objectFit: 'contain' }}
      />
    </Dialog>
  )
}

interface TripDocumentsProps {
  orgId: string
  tripId: string
  documents: TripDocumentsState
  role: Role | null
  uid: string
  canWrite: boolean
  /** The names of the organization's members, by uid. */
  nameOf: (uid: string) => string | null
}

/** "Documentos" of a trip (backend specs/0037 RF-9 to RF-12). */
export default function TripDocuments({
  orgId,
  tripId,
  documents: state,
  role,
  uid,
  canWrite,
  nameOf,
}: TripDocumentsProps) {
  const cameraRef = useRef<HTMLInputElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const [chosen, setChosen] = useState<{
    file: File
    kind: 'photo' | 'pdf'
    name: string
    preview: string | null
  } | null>(null)
  const [viewing, setViewing] = useState<{ url: string; name: string } | null>(
    null
  )
  const [renaming, setRenaming] = useState<TripDocument | null>(null)
  const { status, documents } = state

  const choose =
    (fromCamera: boolean) => (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      // The same file can be chosen again
      event.target.value = ''
      if (!file) return
      const issue = fileIssue(file, documents.length)
      if (issue) {
        sileo.warning({ title: issue })
        return
      }
      if (!navigator.onLine) {
        sileo.warning({ title: OFFLINE_UPLOAD })
        return
      }
      const kind = fileKindOf(file)
      if (!kind) return
      setChosen({
        file,
        kind,
        name: defaultDocumentName(file, fromCamera, new Date()),
        // Freed when its dialog closes
        preview: kind === 'photo' ? URL.createObjectURL(file) : null,
      })
    }

  const rename = (document: TripDocument, name: string) => {
    const before = document.name
    state.renamed(document.id, name)
    renameTripDocument(document.id, name)
      .then(() => {
        sileo.success({ title: 'Documento renombrado' })
      })
      .catch((error: unknown) => {
        state.renamed(document.id, before)
        reportError(error, { operation: 'renameTripDocument' })
        if (recoverFromLostPermission(error)) return
        sileo.error({
          title: 'No pudimos renombrar el documento',
          description: 'Revisa tu conexión y vuelve a intentarlo.',
        })
      })
  }

  const remove = (document: TripDocument) => {
    state.removed(document.id)
    deleteTripDocument(document.id)
      .then(() => {
        sileo.success({ title: 'Documento borrado' })
      })
      .catch((error: unknown) => {
        state.added(document)
        reportError(error, { operation: 'deleteTripDocument' })
        if (recoverFromLostPermission(error)) return
        sileo.error({
          title: 'No pudimos borrar el documento',
          description: 'Revisa tu conexión y vuelve a intentarlo.',
        })
      })
  }

  return (
    <Box component="section" aria-labelledby="trip-documents-title">
      <Typography
        id="trip-documents-title"
        variant="overline"
        component="h2"
        sx={{ color: 'text.secondary' }}
      >
        {status === 'ready' && documents.length > 0
          ? `Documentos (${String(documents.length)})`
          : 'Documentos'}
      </Typography>
      {status === 'error' && (
        <Box sx={{ mt: 2 }}>
          <Typography variant="body2" sx={{ color: 'text.secondary' }}>
            No pudimos cargar los documentos. {RETRY_HINT}
          </Typography>
          <Button onClick={state.retry} sx={{ ml: -2 }}>
            Reintentar
          </Button>
        </Box>
      )}
      {status === 'loading' && (
        <Skeleton variant="rounded" height={64} sx={{ mt: 2 }} />
      )}
      {status === 'ready' &&
        (documents.length === 0 ? (
          <Typography variant="body2" sx={{ mt: 2, color: 'text.secondary' }}>
            Aún no hay documentos en este viaje.
          </Typography>
        ) : (
          <Stack
            component="ul"
            aria-label="Documentos del viaje"
            spacing={2}
            sx={{ listStyle: 'none', m: 0, mt: 2, p: 0 }}
          >
            {documents.map(document => (
              <DocumentCard
                key={document.id}
                document={document}
                author={
                  document.createdBy === uid ? 'ti' : nameOf(document.createdBy)
                }
                canManage={canManageDocument(role, uid, document)}
                onOpen={url => {
                  setViewing({ url, name: document.name })
                }}
                onRename={() => {
                  setRenaming(document)
                }}
                onDelete={() => {
                  remove(document)
                }}
              />
            ))}
          </Stack>
        ))}
      {canWrite && status === 'ready' && (
        <Stack direction="row" spacing={2} sx={{ mt: 3, flexWrap: 'wrap' }}>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            hidden
            aria-label="Foto de la cámara"
            onChange={choose(true)}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf,.pdf"
            hidden
            aria-label="Archivo del teléfono"
            onChange={choose(false)}
          />
          <Button
            variant="outlined"
            startIcon={<PhotoCameraOutlinedIcon />}
            onClick={() => cameraRef.current?.click()}
          >
            Tomar foto
          </Button>
          <Button
            variant="outlined"
            startIcon={<UploadFileOutlinedIcon />}
            onClick={() => fileRef.current?.click()}
          >
            Subir archivo
          </Button>
        </Stack>
      )}

      {chosen && (
        <NewDocumentDialog
          file={chosen.file}
          kind={chosen.kind}
          preview={chosen.preview}
          defaultName={chosen.name}
          orgId={orgId}
          tripId={tripId}
          onUploaded={state.added}
          onClose={() => {
            if (chosen.preview) URL.revokeObjectURL(chosen.preview)
            setChosen(null)
          }}
        />
      )}
      {renaming && (
        <RenameDialog
          document={renaming}
          onRenamed={name => {
            rename(renaming, name)
          }}
          onClose={() => {
            setRenaming(null)
          }}
        />
      )}
      {viewing && (
        <PhotoViewer
          url={viewing.url}
          name={viewing.name}
          onClose={() => {
            setViewing(null)
          }}
        />
      )}
    </Box>
  )
}
