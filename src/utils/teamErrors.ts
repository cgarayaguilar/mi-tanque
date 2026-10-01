// Reasons the `team` and `account` callables give (backend specs/0005 RF-6)
export type TeamErrorReason =
  | 'not-member'
  | 'forbidden'
  | 'invalid-invitation'
  | 'expired'
  | 'used'
  | 'already-member'
  | 'last-owner'
  | 'limit'
  | 'name-required'
  | 'must-transfer'

/** The reason in a callable error's details, if any. */
export const teamErrorReason = (error: unknown): TeamErrorReason | null => {
  if (typeof error !== 'object' || error === null || !('details' in error)) {
    return null
  }
  const { details } = error as { details?: { reason?: unknown } }
  return typeof details?.reason === 'string'
    ? (details.reason as TeamErrorReason)
    : null
}

/** Extra data of the error (organization ids and names). */
export const teamErrorDetails = (error: unknown): Record<string, unknown> =>
  typeof error === 'object' &&
  error !== null &&
  'details' in error &&
  typeof error.details === 'object' &&
  error.details !== null
    ? (error.details as Record<string, unknown>)
    : {}

/** What to tell the user (voice: tú, §9). */
export const teamErrorMessage = (error: unknown): string => {
  switch (teamErrorReason(error)) {
    case 'forbidden':
      return 'Tu rol no permite hacer esto.'
    case 'not-member':
      return 'Ya no eres parte de esta organización.'
    case 'last-owner':
      return 'La organización necesita al menos un Dueño. Nombra a otro Dueño primero.'
    case 'limit':
      return 'Llegaste al límite. Revoca o elimina algo antes de seguir.'
    case 'invalid-invitation':
      return 'Este enlace no es válido. Pide uno nuevo a tu equipo.'
    case 'expired':
      return 'Este enlace venció. Pide uno nuevo a tu equipo.'
    case 'used':
      return 'Este enlace ya se usó. Pide uno nuevo a tu equipo.'
    case 'already-member':
      return 'Ya eres parte de esta organización.'
    case 'name-required':
      return 'Escribe tu nombre para unirte.'
    case 'must-transfer':
      return 'Nombra a otro Dueño en tus organizaciones compartidas antes de eliminar tu cuenta.'
    case null:
      return 'Revisa tu conexión y vuelve a intentarlo.'
  }
}

/** The rules rejected a write: the role or membership changed (RF-12). */
export const isPermissionDenied = (error: unknown) =>
  typeof error === 'object' &&
  error !== null &&
  'code' in error &&
  (error.code === 'permission-denied' ||
    error.code === 'functions/permission-denied')
