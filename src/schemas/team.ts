// zod/mini, like the other form schemas (§5.8)
import * as z from 'zod/mini'
import { INVITABLE_ROLES } from 'utils/roles'

/** Mi cuenta → Equipo → invitar (backend specs/0005 RF-1). */
export const inviteFormSchema = z.object({
  role: z.enum(INVITABLE_ROLES, { error: 'Elige un rol' }),
})
export type InviteFormValues = z.infer<typeof inviteFormSchema>

/** The word typed to delete the account (RF-14). */
export const DELETE_CONFIRMATION = 'ELIMINAR'

export const deleteAccountFormSchema = z.object({
  confirmation: z.string().check(
    z.trim(),
    z.refine(value => value === DELETE_CONFIRMATION, {
      error: `Escribe ${DELETE_CONFIRMATION} para confirmar`,
    })
  ),
})
export type DeleteAccountFormValues = z.infer<typeof deleteAccountFormSchema>
