import { useId, useState, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Button from '@mui/material/Button'
import Collapse from '@mui/material/Collapse'
import Stack from '@mui/material/Stack'
import ExpandLessIcon from '@mui/icons-material/ExpandLess'
import ExpandMoreIcon from '@mui/icons-material/ExpandMore'
import type {
  FieldErrors,
  FieldPath,
  FieldValues,
  UseFormSetFocus,
} from 'react-hook-form'

interface MoreDetailsProps {
  open: boolean
  onToggle: () => void
  /** How many of its fields hold something: "Ver más detalles · 4 datos". */
  filled: number
  children: ReactNode
}

/**
 * The fields that are not essential, one tap away (backend specs/0009 RF-5).
 * They stay mounted while closed: their values are kept and saved.
 */
export default function MoreDetails({
  open,
  onToggle,
  filled,
  children,
}: MoreDetailsProps) {
  const regionId = useId()
  const closedLabel =
    filled > 0
      ? `Ver más detalles · ${String(filled)} ${filled === 1 ? 'dato' : 'datos'}`
      : 'Ver más detalles'
  return (
    <Box>
      <Button
        variant="text"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={regionId}
        endIcon={open ? <ExpandLessIcon /> : <ExpandMoreIcon />}
        sx={{ px: 0 }}
      >
        {open ? 'Ocultar detalles' : closedLabel}
      </Button>
      <Collapse in={open}>
        <Stack id={regionId} spacing={6} sx={{ pt: 4 }}>
          {children}
        </Stack>
      </Collapse>
    </Box>
  )
}

/**
 * Open state of "Ver más detalles", and what to do when a save fails on a
 * field inside it: open it and take the user there (RF-6). Pass `onInvalid`
 * as handleSubmit's second argument.
 */
export const useMoreDetails = <T extends FieldValues>(
  hidden: readonly FieldPath<T>[],
  setFocus: UseFormSetFocus<T>
) => {
  const [open, setOpen] = useState(false)
  const onInvalid = (errors: FieldErrors<T>) => {
    const first = hidden.find(name => name in errors)
    if (first === undefined) return
    setOpen(true)
    // After the section opens: a closed one cannot take the focus
    setTimeout(() => {
      setFocus(first)
    }, 0)
  }
  return {
    open,
    toggle: () => {
      setOpen(value => !value)
    },
    onInvalid,
  }
}

/** How many of these form values hold something. */
export const countFilled = (values: readonly unknown[]) =>
  values.filter(value =>
    typeof value === 'string' ? value.trim() !== '' : value != null
  ).length
