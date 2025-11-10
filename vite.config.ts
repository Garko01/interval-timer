import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CHANGE THIS to your repo name
const repo = 'interval-timer'

export default defineConfig({
  plugins: [react()],
  base: `/${repo}/`,
  // @ts-ignore - test config for vitest
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/__tests__/setup.ts'],
  },
})
