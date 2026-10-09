import { useState, type ReactNode } from 'react'
import CategoryDialog from './CategoryDialog'
import ClientDialog from './ClientDialog'
import DriverDialog from './DriverDialog'
import RateDialog from './RateDialog'
import TrailerDialog from './TrailerDialog'
import TruckDialog from './TruckDialog'

export type CreateKind =
  'client' | 'driver' | 'truck' | 'trailer' | 'rate' | 'category'

interface Open {
  kind: CreateKind
  text: string
  onCreated: (id: string) => void
}

/**
 * The "+ Crear …" dialogs of a form (backend specs/0028): `create` opens the
 * one asked for, with what was typed, and `dialog` goes in the page.
 */
export const useCreateDialogs = (orgId: string) => {
  const [open, setOpen] = useState<Open | null>(null)

  const create = (
    kind: CreateKind,
    text: string,
    onCreated: (id: string) => void
  ) => {
    setOpen({ kind, text, onCreated })
  }

  const props = open && {
    orgId,
    initialName: open.text,
    onCreated: open.onCreated,
    onClose: () => {
      setOpen(null)
    },
  }

  const dialogs: Record<
    CreateKind,
    (p: NonNullable<typeof props>) => ReactNode
  > = {
    client: p => <ClientDialog {...p} />,
    driver: p => <DriverDialog {...p} />,
    truck: p => <TruckDialog {...p} />,
    trailer: p => <TrailerDialog {...p} />,
    rate: p => <RateDialog {...p} />,
    category: p => <CategoryDialog category={null} {...p} />,
  }

  return {
    create,
    dialog: open && props ? dialogs[open.kind](props) : null,
  }
}
