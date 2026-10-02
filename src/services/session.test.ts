const sdk = vi.hoisted(() => ({
  hosts: [] as HTMLElement[],
  RecaptchaVerifier: vi.fn(function (
    this: { clear: () => void },
    _auth: unknown,
    host: HTMLElement
  ) {
    // Like reCAPTCHA: one widget per element
    if (sdk.hosts.includes(host)) {
      throw new Error('reCAPTCHA has already been rendered in this element')
    }
    sdk.hosts.push(host)
    this.clear = () => undefined
  }),
  signInWithPhoneNumber: vi.fn(() =>
    Promise.resolve({ confirm: () => Promise.resolve() })
  ),
}))

vi.mock('firebase/auth', async importOriginal => ({
  ...(await importOriginal<object>()),
  RecaptchaVerifier: sdk.RecaptchaVerifier,
  signInWithPhoneNumber: sdk.signInWithPhoneNumber,
}))
vi.mock('services/firebase', () => ({
  loadFirebase: () => Promise.resolve({ auth: { name: 'auth' } }),
}))

// Regression: "Resend code" and "Change number" reused the element of the
// first, cleared verifier and failed with "already been rendered"
test('every code sent gets its own reCAPTCHA element', async () => {
  const { sendPhoneCode } = await import('services/session')
  const container = document.createElement('div')

  await sendPhoneCode('+50588887777', container)
  await sendPhoneCode('+50588887777', container)

  expect(sdk.signInWithPhoneNumber).toHaveBeenCalledTimes(2)
  expect(sdk.hosts[0]).not.toBe(sdk.hosts[1])
  expect(container.children).toHaveLength(1)
})
