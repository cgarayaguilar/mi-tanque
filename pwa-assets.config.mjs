import { defineConfig } from '@vite-pwa/assets-generator/config'

// Source icon already has a full-bleed background and keeps the logo inside the
// maskable safe zone, so no extra padding is needed.
const background = '#142850'

export default defineConfig({
  headLinkOptions: { preset: '2023' },
  preset: {
    transparent: {
      sizes: [64, 192, 512],
      favicons: [[48, 'favicon.ico']],
      padding: 0,
    },
    maskable: {
      sizes: [512],
      padding: 0,
      resizeOptions: { background },
    },
    apple: {
      sizes: [180],
      padding: 0,
      resizeOptions: { background },
    },
  },
  images: ['public/pwa-icon.svg'],
})
