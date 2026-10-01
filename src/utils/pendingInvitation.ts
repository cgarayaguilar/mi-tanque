// The invitation being accepted while the person signs in (backend specs/0005
// RF-4). Per tab, so a Google redirect comes back to it.
const KEY = 'pendingInvitation'

export const rememberInvitation = (token: string) => {
  try {
    sessionStorage.setItem(KEY, token)
  } catch {
    // Without storage the person opens the link again after signing in
  }
}

export const pendingInvitation = (): string | null => {
  try {
    return sessionStorage.getItem(KEY)
  } catch {
    return null
  }
}

export const forgetInvitation = () => {
  try {
    sessionStorage.removeItem(KEY)
  } catch {
    // Nothing to forget
  }
}
