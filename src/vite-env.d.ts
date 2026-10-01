/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  /** "true" connects Auth and Firestore to the local Firebase emulators. */
  readonly VITE_USE_EMULATORS?: string
}
