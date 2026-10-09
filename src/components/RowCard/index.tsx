import { useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import ButtonBase from '@mui/material/ButtonBase'
import IconButton from '@mui/material/IconButton'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Typography from '@mui/material/Typography'
import MoreVertIcon from '@mui/icons-material/MoreVert'
import ConfirmDialog from 'components/ConfirmDialog'
import { radius, softShadow, typeScale } from 'theme/tokens'

export interface RowRemoval {
  /** "Opciones del gasto de Peajes" (RNF-3). */
  menuLabel: string
  /** "¿Quitar este gasto del viaje?" */
  title: string
  /** "Se borra al guardar el viaje." */
  description: string
  onRemove: () => void
}

interface RowCardProps {
  /** What a screen reader says: "Gasto de Peajes, C$350.00 NIO". */
  label: string
  title: string
  amount: string
  /** Under the amount, in small type: its date, its description… */
  lines?: (string | null | undefined)[]
  /** After the title: the "Relleno" chip, the receipt's icon. */
  marks?: ReactNode
  /** It failed to save: "Revisa este gasto". */
  issue?: string | null | undefined
  /** Tapping it; without it, the card is not a button. */
  onClick?: (() => void) | undefined
  /** Its ⋮ menu with "Quitar"; without it, no menu. */
  removal?: RowRemoval
}

/**
 * An income or an expense of the trip's form, as a card (backend specs/0029
 * RF-5): tapping it edits it, and its ⋮ menu removes it after asking.
 */
export default function RowCard({
  label,
  title,
  amount,
  lines = [],
  marks,
  issue,
  onClick,
  removal,
}: RowCardProps) {
  const [menuAnchor, setMenuAnchor] = useState<HTMLElement | null>(null)
  const [confirming, setConfirming] = useState(false)

  const body = (
    <>
      <Box
        component="span"
        sx={{ display: 'flex', alignItems: 'center', gap: 2 }}
      >
        <Typography
          component="span"
          variant="subtitle1"
          sx={{ flexGrow: 1, minWidth: 0, overflowWrap: 'anywhere' }}
        >
          {title}
        </Typography>
        {marks}
      </Box>
      <Typography
        component="span"
        sx={{
          ...typeScale.figureSm,
          display: 'block',
          my: 0.5,
          overflowWrap: 'anywhere',
        }}
      >
        {amount}
      </Typography>
      {lines
        .filter((line): line is string => Boolean(line))
        .map(line => (
          <Typography
            key={line}
            component="span"
            variant="caption"
            noWrap
            sx={{ display: 'block', color: 'text.secondary' }}
          >
            {line}
          </Typography>
        ))}
      {issue && (
        <Typography
          component="span"
          variant="caption"
          sx={{ display: 'block', color: 'error.main' }}
        >
          {issue}
        </Typography>
      )}
    </>
  )

  const content = {
    flexGrow: 1,
    minWidth: 0,
    display: 'block',
    px: 4,
    py: 3,
    textAlign: 'left',
  } as const

  return (
    <Box
      component="li"
      sx={{
        display: 'flex',
        alignItems: 'flex-start',
        bgcolor: 'background.paper',
        border: 1,
        borderColor: issue ? 'error.main' : 'divider',
        borderRadius: `${String(radius.lg)}px`,
        overflow: 'hidden',
        transition: 'box-shadow 0.15s',
        ...(onClick && { '&:hover': { boxShadow: softShadow } }),
      }}
    >
      {onClick ? (
        <ButtonBase onClick={onClick} aria-label={label} sx={content}>
          {body}
        </ButtonBase>
      ) : (
        <Box aria-label={label} role="group" sx={content}>
          {body}
        </Box>
      )}
      {removal && (
        <>
          <IconButton
            aria-label={removal.menuLabel}
            aria-haspopup="menu"
            onClick={event => {
              setMenuAnchor(event.currentTarget)
            }}
            sx={{ m: 1 }}
          >
            <MoreVertIcon />
          </IconButton>
          <Menu
            anchorEl={menuAnchor}
            open={menuAnchor !== null}
            onClose={() => {
              setMenuAnchor(null)
            }}
          >
            <MenuItem
              onClick={() => {
                setMenuAnchor(null)
                setConfirming(true)
              }}
            >
              Quitar
            </MenuItem>
          </Menu>
          <ConfirmDialog
            open={confirming}
            title={removal.title}
            description={removal.description}
            confirmLabel="Quitar"
            onConfirm={() => {
              setConfirming(false)
              removal.onRemove()
            }}
            onClose={() => {
              setConfirming(false)
            }}
          />
        </>
      )}
    </Box>
  )
}
