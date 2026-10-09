/** What every "+ Crear …" dialog takes (backend specs/0028 RF-2). */
export interface CreateDialogProps {
  orgId: string
  /** What was typed in the list: it goes in the name. */
  initialName?: string
  /** Chosen in the field the dialog was opened from. */
  onCreated: (id: string) => void
  onClose: () => void
}
