/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { presetsApiPlugin } from './vite-plugin-presets-api'

export default defineConfig({
  plugins: [react(), tailwindcss(), presetsApiPlugin()],
  test: {
    globals: true,
    environment: 'node',
  },
})
