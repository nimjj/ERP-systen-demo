import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

const seedDir = fileURLToPath(new URL('../seed', import.meta.url))

export default defineConfig({
  // Relative base so the built site works from any static server path.
  base: './',
  plugins: [react()],
  resolve: { alias: { '@seed': seedDir } },
  server: { fs: { allow: ['..'] } },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts', 'tests/**/*.test.ts'],
  },
})
