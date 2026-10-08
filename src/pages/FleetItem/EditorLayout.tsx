import { useState, type ReactNode } from 'react'
import { useLocation } from 'wouter'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import UnarchiveOutlinedIcon from '@mui/icons-material/UnarchiveOutlined'
import ConfirmDialog from 'components/ConfirmDialog'
import PhotoField from 'components/PhotoField'
import { photoUrl, uploadFleetPhoto } from 'services/fleet'
import { useFleetStore } from 'store/fleet'
import { recoverFromLostPermission, useSessionStore } from 'store/session'
import type { FleetSection } from 'utils/fleetSections'
import { reportError } from 'utils/reportError'

interface EditorLayoutProps {
  section: FleetSection
  /** The item being edited, or null for a new one. */
  item: {
    id: string
    name: string
    archived: boolean
    /** Only in sections with photos (not clients). */
    photoPath?: string | null
  } | null
  /** The id the new item will have (made when the form opened). */
  id: string
  canWrite: boolean
  /** The form; its submit button is rendered by the layout. */
  children: ReactNode
  formId: string
  saving: boolean
}

const capitalize = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1)

/** Shared frame of the fleet's screens (specs/0003) and clients' (0022). */
export default function EditorLayout({
  section,
  item,
  id,
  canWrite,
  children,
  formId,
  saving,
}: EditorLayoutProps) {
  const [, navigate] = useLocation()
  const orgId = useSessionStore(state => state.organization?.id ?? '')
  const setArchived = useFleetStore(state => state.setArchived)
  const setPhotoPath = useFleetStore(state => state.setPhotoPath)
  const [confirming, setConfirming] = useState(false)
  const back = `/flota/${section.slug}`
  const one = capitalize(section.one)

  const archive = (archived: boolean) => {
    setConfirming(false)
    setArchived(section.collection, id, archived).catch((error: unknown) => {
      reportError(error, {
        operation: 'archiveFleetItem',
        collection: section.collection,
      })
      if (recoverFromLostPermission(error)) return
      sileo.error({
        title: `No pudimos ${archived ? 'archivar' : 'restaurar'} el ${section.one}`,
        description: 'Revisa tu conexión y vuelve a intentarlo.',
      })
    })
    sileo.success({ title: `${one} ${archived ? 'archivado' : 'restaurado'}` })
    navigate(back)
  }

  return (
    <Box component="main" sx={{ px: 4, pt: 2, pb: 8 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => {
          navigate(back)
        }}
        sx={{ ml: -2, mb: 2 }}
      >
        {section.label}
      </Button>
      <Stack direction="row" spacing={2} sx={{ alignItems: 'center', mb: 6 }}>
        <Typography
          variant="h3"
          component="h1"
          sx={{ minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {item ? item.name : `Nuevo ${section.one}`}
        </Typography>
        {item?.archived && <Chip label="Archivado" size="small" />}
      </Stack>

      {children}

      {canWrite && (
        <Button
          type="submit"
          form={formId}
          variant="contained"
          size="large"
          fullWidth
          loading={saving}
          loadingPosition="start"
          sx={{ mt: 8 }}
        >
          {item ? 'Guardar cambios' : `Guardar ${section.one}`}
        </Button>
      )}

      {item && section.photo && (
        <Box sx={{ mt: 8 }}>
          <PhotoField
            alt={`Foto de ${item.name}`}
            path={item.photoPath ?? null}
            loadUrl={photoUrl}
            upload={file =>
              uploadFleetPhoto(section.collection, orgId, id, file)
            }
            onUploaded={path => {
              setPhotoPath(section.collection, id, path)
            }}
            disabled={!canWrite}
          />
        </Box>
      )}
      {!item && canWrite && section.photo && (
        <Typography
          variant="caption"
          component="p"
          sx={{ mt: 4, color: 'text.secondary' }}
        >
          Después de guardarlo podrás agregarle una foto.
        </Typography>
      )}

      {item && canWrite && (
        <Button
          variant="outlined"
          size="large"
          fullWidth
          startIcon={
            item.archived ? <UnarchiveOutlinedIcon /> : <ArchiveOutlinedIcon />
          }
          onClick={() => {
            if (item.archived) archive(false)
            else setConfirming(true)
          }}
          sx={{ mt: 8 }}
        >
          {item.archived ? 'Restaurar' : 'Archivar'}
        </Button>
      )}

      <ConfirmDialog
        open={confirming}
        title={`¿Archivar ${item?.name ?? ''}?`}
        description={`Dejará de aparecer en la flota y en los formularios. Su historial se conserva y puedes restaurarlo desde "Ver archivados".`}
        confirmLabel="Archivar"
        onConfirm={() => {
          archive(true)
        }}
        onClose={() => {
          setConfirming(false)
        }}
      />
    </Box>
  )
}
