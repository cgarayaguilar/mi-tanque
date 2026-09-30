import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import svgr from 'vite-plugin-svgr'

const srcDir = fileURLToPath(new URL('./src', import.meta.url))

// Top-level folders in src/ that are imported as absolute paths
// (e.g. `import Button from 'components/Button'`), as CRA allowed via jsconfig baseUrl.
const absoluteImportDirs = [
  'assets',
  'components',
  'hooks',
  'pages',
  'services',
  'store',
  'styles',
  'utils',
]

export default defineConfig({
  plugins: [react(), svgr()],
  resolve: {
    alias: [
      {
        find: new RegExp(`^(${absoluteImportDirs.join('|')})(?=/|$)`),
        replacement: `${srcDir}/$1`,
      },
    ],
  },
  server: {
    port: 3000,
  },
  build: {
    outDir: 'build',
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/setupTests.js',
  },
})
