import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// CHANGE THIS to your repo name
const repo = 'interval-timer'

export default defineConfig({
  plugins: [react()],
  base: `/${repo}/`,
})
