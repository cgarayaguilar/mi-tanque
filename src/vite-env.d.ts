/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" connects Auth and Firestore to the local Firebase emulators. */
  readonly VITE_USE_EMULATORS?: string
  /**
   * MUI X Pro license (period calendar). Set by the owner in Vercel and in
   * .env.local; never committed. Without it the calendar shows a watermark.
   */
  readonly VITE_MUI_X_LICENSE_KEY?: string
}
