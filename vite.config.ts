import { defineConfig } from 'vite'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  server: {
    host: '127.0.0.1',
    port: 5188,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    lib: {
      entry: fileURLToPath(new URL('./src/index.ts', import.meta.url)),
      name: 'TrpgReplay',
      formats: ['es', 'iife'],
      fileName: (format) => (format === 'es' ? 'trpg-replay.mjs' : 'trpg-replay.js'),
    },
    minify: 'esbuild',
    rollupOptions: {
      output: { exports: 'named' },
    },
  },
})
