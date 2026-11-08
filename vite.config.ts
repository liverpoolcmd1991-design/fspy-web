import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vitejs.dev/config/
export default defineConfig({
  base: '', // Not using "/" to allow deployments on a subpath, e.g. on GitHub Pages
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three'],
          react: ['react', 'react-dom', 'zustand'],
        },
      },
    },
  },
  plugins: [react(), tailwindcss()],
  publicDir: 'assets/electron',
  server: {
    port: 3000,
    host: '0.0.0.0',
  },
})

