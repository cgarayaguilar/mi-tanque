import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { sileo } from 'sileo'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Chip from '@mui/material/Chip'
import Dialog from '@mui/material/Dialog'
import DialogActions from '@mui/material/DialogActions'
import DialogContent from '@mui/material/DialogContent'
import DialogContentText from '@mui/material/DialogContentText'
import DialogTitle from '@mui/material/DialogTitle'
import FormControlLabel from '@mui/material/FormControlLabel'
import IconButton from '@mui/material/IconButton'
import Link from '@mui/material/Link'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Radio from '@mui/material/Radio'
import RadioGroup from '@mui/material/RadioGroup'
import Skeleton from '@mui/material/Skeleton'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import ContentCopyIcon from '@mui/icons-material/ContentCopy'
import LinkIcon from '@mui/icons-material/Link'
import LogoutIcon from '@mui/icons-material/Logout'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ShareIcon from '@mui/icons-material/Share'
import ConfirmDialog from 'components/ConfirmDialog'
import ChoiceButtons from 'components/ChoiceButtons'
import { useLoad } from 'hooks/useLoad'
import { inviteFormSchema, type InviteFormValues } from 'schemas/team'
import {
  callTeam,
  createInvitation,
  invitationLink,
  readPendingInvitations,
  readTeam,
  type PendingInvitation,
  type TeamMember,
} from 'services/team'
import { selectActiveRole, useSessionStore } from 'store/session'
import { radius } from 'theme/tokens'
import { formatMeasurementDate } from 'utils/formatDate'
import { reportError } from 'utils/reportError'
import {
  assignableRolesFor,
  canManageMember,
  invitableRolesFor,
  ROLE_LABELS,
  type InvitableRole,
  type Role,
} from 'utils/roles'
import { teamErrorMessage } from 'utils/teamErrors'

const failed = (operation: string, title: string) => (error: unknown) => {
  reportError(error, { operation })
  sileo.error({ title, description: teamErrorMessage(error) })
}

function MemberRow({
  member,
  isMe,
  canChangeRole,
  canRemove,
  onChangeRole,
  onRemove,
}: {
  member: TeamMember
  isMe: boolean
  canChangeRole: boolean
  canRemove: boolean
  onChangeRole: () => void
  onRemove: () => void
}) {
  const [anchor, setAnchor] = useState<HTMLElement | null>(null)
  const contact = member.phoneNumber ?? member.email
  return (
    <Box
      component="li"
      sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 3 }}
    >
      <Box sx={{ minWidth: 0, flexGrow: 1 }}>
        <Typography variant="subtitle2" component="p" noWrap>
          {member.displayName}
          {isMe && ' (tú)'}
        </Typography>
        {contact && (
          <Link
            variant="caption"
            href={member.phoneNumber ? `tel:${contact}` : `mailto:${contact}`}
            sx={{ color: 'text.secondary', display: 'block' }}
            noWrap
          >
            {contact}
          </Link>
        )}
      </Box>
      <Chip label={ROLE_LABELS[member.role]} size="small" />
      {(canChangeRole || canRemove) && (
        <>
          <IconButton
            size="small"
            aria-label={`Opciones de ${member.displayName}`}
            onClick={event => {
              setAnchor(event.currentTarget)
            }}
          >
            <MoreVertIcon fontSize="small" />
          </IconButton>
          <Menu
            anchorEl={anchor}
            open={anchor !== null}
            onClose={() => {
              setAnchor(null)
            }}
          >
            {canChangeRole && (
              <MenuItem
                onClick={() => {
                  setAnchor(null)
                  onChangeRole()
                }}
              >
                {isMe ? 'Cambiar mi rol' : 'Cambiar rol'}
              </MenuItem>
            )}
            {canRemove && (
              <MenuItem
                onClick={() => {
                  setAnchor(null)
                  onRemove()
                }}
              >
                Sacar del equipo
              </MenuItem>
            )}
          </Menu>
        </>
      )}
    </Box>
  )
}

function RoleDialog({
  member,
  roles,
  onClose,
  onSave,
}: {
  member: TeamMember
  roles: Role[]
  onClose: () => void
  onSave: (role: Role) => void
}) {
  const [role, setRole] = useState<Role>(member.role)
  return (
    <Dialog open onClose={onClose} aria-labelledby="role-title" fullWidth>
      <DialogTitle id="role-title">Rol de {member.displayName}</DialogTitle>
      <DialogContent>
        <RadioGroup
          aria-labelledby="role-title"
          value={role}
          onChange={event => {
            setRole(event.target.value as Role)
          }}
        >
          {roles.map(option => (
            <FormControlLabel
              key={option}
              value={option}
              control={<Radio />}
              label={ROLE_LABELS[option]}
            />
          ))}
        </RadioGroup>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancelar</Button>
        <Button
          variant="contained"
          disabled={role === member.role}
          onClick={() => {
            onSave(role)
          }}
        >
          Guardar
        </Button>
      </DialogActions>
    </Dialog>
  )
}

const canShare = () => typeof navigator.share === 'function'

function LinkDialog({
  link,
  role,
  orgName,
  expiresAt,
  onClose,
}: {
  link: string
  role: InvitableRole
  orgName: string
  expiresAt: Date
  onClose: () => void
}) {
  const message = `Te invito a ${orgName} en Solo Camioneros como ${ROLE_LABELS[role]}: ${link}`
  return (
    <Dialog open onClose={onClose} aria-labelledby="link-title" fullWidth>
      <DialogTitle id="link-title">Enlace para {ROLE_LABELS[role]}</DialogTitle>
      <DialogContent>
        <Typography
          component="p"
          variant="body2"
          sx={{
            p: 3,
            mb: 3,
            border: 1,
            borderColor: 'divider',
            borderRadius: `${String(radius.md)}px`,
            wordBreak: 'break-all',
            userSelect: 'all',
          }}
        >
          {link}
        </Typography>
        <DialogContentText>
          Sirve para una persona y vence el {formatMeasurementDate(expiresAt)}.
          Solo se muestra ahora: si lo pierdes, crea otro.
        </DialogContentText>
      </DialogContent>
      <DialogActions sx={{ flexWrap: 'wrap', gap: 1 }}>
        <Button onClick={onClose}>Listo</Button>
        <Button
          variant={canShare() ? 'outlined' : 'contained'}
          startIcon={<ContentCopyIcon />}
          onClick={() => {
            navigator.clipboard.writeText(link).then(
              () => {
                sileo.success({ title: 'Enlace copiado' })
              },
              failed('copyInvitation', 'No pudimos copiar el enlace')
            )
          }}
        >
          Copiar enlace
        </Button>
        {canShare() && (
          <Button
            variant="contained"
            startIcon={<ShareIcon />}
            onClick={() => {
              navigator
                .share({ title: `Invitación a ${orgName}`, text: message })
                .catch((error: unknown) => {
                  // Closing the share sheet is not an error
                  if ((error as { name?: unknown }).name !== 'AbortError') {
                    failed(
                      'shareInvitation',
                      'No pudimos compartir el enlace'
                    )(error)
                  }
                })
            }}
          >
            Compartir
          </Button>
        )}
      </DialogActions>
    </Dialog>
  )
}

function InviteForm({
  orgId,
  orgName,
  roles,
  onCreated,
}: {
  orgId: string
  orgName: string
  roles: InvitableRole[]
  onCreated: () => void
}) {
  const [created, setCreated] = useState<{
    link: string
    role: InvitableRole
    expiresAt: Date
  } | null>(null)
  const {
    handleSubmit,
    control,
    formState: { isSubmitting },
  } = useForm<InviteFormValues>({
    resolver: zodResolver(inviteFormSchema),
    defaultValues: {
      role: roles.includes('driver') ? 'driver' : (roles[0] ?? 'viewer'),
    },
  })

  const create = async ({ role }: InviteFormValues) => {
    try {
      const { token, expiresAt } = await createInvitation(orgId, role)
      setCreated({
        link: invitationLink(token),
        role,
        expiresAt: new Date(expiresAt),
      })
      onCreated()
    } catch (error) {
      failed('createInvitation', 'No pudimos crear el enlace')(error)
    }
  }

  return (
    <Box
      component="form"
      noValidate
      aria-label="Invitar a alguien"
      onSubmit={event => {
        void handleSubmit(create)(event)
      }}
      sx={{ mt: 4 }}
    >
      <ChoiceButtons
        id="inviteRole"
        label="Invitar como"
        options={roles.map(role => ({ value: role, label: ROLE_LABELS[role] }))}
        hint="Crea un enlace para una persona; vence en 7 días."
        control={control}
        name="role"
      />
      <Button
        type="submit"
        variant="outlined"
        fullWidth
        startIcon={<LinkIcon />}
        loading={isSubmitting}
        loadingPosition="start"
        sx={{ mt: 3 }}
      >
        Crear enlace
      </Button>
      {created && (
        <LinkDialog
          {...created}
          orgName={orgName}
          onClose={() => {
            setCreated(null)
          }}
        />
      )}
    </Box>
  )
}

function PendingList({
  invitations,
  actor,
  onRevoke,
}: {
  invitations: PendingInvitation[]
  actor: Role | null
  onRevoke: (invitation: PendingInvitation) => void
}) {
  if (invitations.length === 0) return null
  return (
    <Box sx={{ mt: 6 }}>
      <Typography
        variant="overline"
        component="h3"
        sx={{ color: 'text.secondary' }}
      >
        Invitaciones pendientes
      </Typography>
      <Box component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
        {invitations.map(invitation => (
          <Box
            component="li"
            key={invitation.id}
            sx={{ display: 'flex', alignItems: 'center', gap: 2, py: 2 }}
          >
            <Box sx={{ flexGrow: 1, minWidth: 0 }}>
              <Typography variant="subtitle2" component="p">
                {ROLE_LABELS[invitation.role]}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                De {invitation.createdByName} · vence el{' '}
                {formatMeasurementDate(invitation.expiresAt)}
              </Typography>
            </Box>
            {canManageMember(actor, invitation.role) && (
              <Button
                size="small"
                onClick={() => {
                  onRevoke(invitation)
                }}
              >
                Revocar
              </Button>
            )}
          </Box>
        ))}
      </Box>
    </Box>
  )
}

type Pending =
  | { kind: 'role'; member: TeamMember }
  | { kind: 'promote'; member: TeamMember }
  | { kind: 'remove'; member: TeamMember }
  | { kind: 'revoke'; invitation: PendingInvitation }
  | { kind: 'leave' }

/** Mi cuenta → Equipo (backend specs/0005 RF-1–RF-11). */
export default function TeamSection() {
  const organization = useSessionStore(state => state.organization)
  const uid = useSessionStore(state => state.user?.uid ?? '')
  const actor = useSessionStore(selectActiveRole)
  const refresh = useSessionStore(state => state.refresh)
  const orgId = organization?.id ?? null
  const orgName = organization?.name ?? ''
  const invitable = invitableRolesFor(actor)
  const team = useLoad(orgId, () =>
    orgId ? readTeam(orgId) : Promise.resolve([])
  )
  const pending = useLoad(invitable.length > 0 ? orgId : null, () =>
    orgId ? readPendingInvitations(orgId) : Promise.resolve([])
  )
  const [dialog, setDialog] = useState<Pending | null>(null)
  const close = () => {
    setDialog(null)
  }

  if (!orgId) return null
  const members = team.value ?? []
  const owners = members.filter(member => member.role === 'owner').length
  const lastOwner = actor === 'owner' && owners <= 1

  const run = (
    operation: string,
    errorTitle: string,
    request: Parameters<typeof callTeam>[0],
    success: string,
    after: () => Promise<void> | void
  ) => {
    close()
    callTeam(request).then(
      async () => {
        sileo.success({ title: success })
        await after()
      },
      failed(operation, errorTitle)
    )
  }

  const changeRole = (member: TeamMember, role: Role) => {
    run(
      'changeRole',
      'No pudimos cambiar el rol',
      { action: 'changeRole', orgId, uid: member.uid, role },
      `${member.uid === uid ? 'Ahora eres' : `${member.displayName} ahora es`} ${ROLE_LABELS[role]}`,
      async () => {
        team.reload()
        if (member.uid === uid) await refresh()
      }
    )
  }

  return (
    <Box
      component="section"
      aria-labelledby="team-title"
      sx={{
        p: 4,
        bgcolor: 'background.paper',
        border: 1,
        borderColor: 'divider',
        borderRadius: `${String(radius.xl)}px`,
      }}
    >
      <Typography id="team-title" variant="subtitle1" component="h2">
        Equipo
      </Typography>
      <Typography variant="body2" sx={{ mt: 1 }}>
        Todos los miembros ven el nombre, el rol y el contacto de los demás.
      </Typography>

      {team.error !== undefined && team.value === undefined ? (
        <Box sx={{ mt: 4 }}>
          <Typography variant="body2" role="alert">
            No pudimos cargar el equipo.
          </Typography>
          <Button onClick={team.reload} sx={{ mt: 2 }}>
            Reintentar
          </Button>
        </Box>
      ) : team.value === undefined ? (
        <Stack
          spacing={2}
          sx={{ mt: 4 }}
          aria-busy="true"
          aria-label="Cargando el equipo"
        >
          <Skeleton variant="rounded" height={44} />
          <Skeleton variant="rounded" height={44} />
        </Stack>
      ) : (
        <Box
          component="ul"
          aria-label="Miembros"
          sx={{
            listStyle: 'none',
            m: 0,
            mt: 2,
            p: 0,
            '& > li + li': { borderTop: 1, borderColor: 'divider' },
          }}
        >
          {members.map(member => {
            const isMe = member.uid === uid
            return (
              <MemberRow
                key={member.uid}
                member={member}
                isMe={isMe}
                canChangeRole={
                  // An owner steps down only while another owner remains
                  isMe
                    ? !lastOwner && actor === 'owner'
                    : canManageMember(actor, member.role)
                }
                canRemove={!isMe && canManageMember(actor, member.role)}
                onChangeRole={() => {
                  setDialog({ kind: 'role', member })
                }}
                onRemove={() => {
                  setDialog({ kind: 'remove', member })
                }}
              />
            )
          })}
        </Box>
      )}

      {invitable.length > 0 && (
        <>
          <InviteForm
            orgId={orgId}
            orgName={orgName}
            roles={invitable}
            onCreated={pending.reload}
          />
          <PendingList
            invitations={pending.value ?? []}
            actor={actor}
            onRevoke={invitation => {
              setDialog({ kind: 'revoke', invitation })
            }}
          />
        </>
      )}

      <Button
        variant="outlined"
        fullWidth
        startIcon={<LogoutIcon />}
        disabled={lastOwner}
        onClick={() => {
          setDialog({ kind: 'leave' })
        }}
        sx={{ mt: 6 }}
      >
        Salir de {orgName}
      </Button>
      {lastOwner && (
        <Typography
          variant="caption"
          component="p"
          sx={{ mt: 1, color: 'text.secondary' }}
        >
          Eres el único Dueño: nombra a otro Dueño para poder salir.
        </Typography>
      )}

      {dialog?.kind === 'role' && (
        <RoleDialog
          member={dialog.member}
          roles={assignableRolesFor(actor)}
          onClose={close}
          onSave={role => {
            if (role === 'owner')
              setDialog({ kind: 'promote', member: dialog.member })
            else changeRole(dialog.member, role)
          }}
        />
      )}
      <ConfirmDialog
        open={dialog?.kind === 'promote'}
        title={`¿Hacer Dueño a ${dialog?.kind === 'promote' ? dialog.member.displayName : ''}?`}
        description="Podrá gestionar todo, incluidos los demás dueños."
        confirmLabel="Hacer Dueño"
        onConfirm={() => {
          if (dialog?.kind === 'promote') changeRole(dialog.member, 'owner')
        }}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog?.kind === 'remove'}
        title={`¿Sacar a ${dialog?.kind === 'remove' ? dialog.member.displayName : ''} del equipo?`}
        description="Dejará de ver la organización. Sus mediciones se conservan con su nombre y su camión queda sin chofer asignado."
        confirmLabel="Sacar"
        onConfirm={() => {
          if (dialog?.kind !== 'remove') return
          const { member } = dialog
          run(
            'removeMember',
            'No pudimos sacarlo del equipo',
            { action: 'removeMember', orgId, uid: member.uid },
            `Sacaste a ${member.displayName} del equipo`,
            team.reload
          )
        }}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog?.kind === 'revoke'}
        title="¿Revocar esta invitación?"
        description="El enlace dejará de funcionar."
        confirmLabel="Revocar"
        onConfirm={() => {
          if (dialog?.kind !== 'revoke') return
          run(
            'revokeInvitation',
            'No pudimos revocar la invitación',
            {
              action: 'revokeInvitation',
              orgId,
              invitationId: dialog.invitation.id,
            },
            'Revocamos la invitación',
            pending.reload
          )
        }}
        onClose={close}
      />
      <ConfirmDialog
        open={dialog?.kind === 'leave'}
        title={`¿Salir de ${orgName}?`}
        description="Dejarás de ver su flota y su historial. Tus mediciones se conservan con tu nombre."
        confirmLabel="Salir"
        onConfirm={() => {
          run(
            'leaveOrganization',
            'No pudimos sacarte de la organización',
            { action: 'leave', orgId },
            `Saliste de ${orgName}`,
            refresh
          )
        }}
        onClose={close}
      />
    </Box>
  )
}
