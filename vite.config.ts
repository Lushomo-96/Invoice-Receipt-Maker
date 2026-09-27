import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  // Deployed as a GitHub Pages *project site* under {owner}.github.io/{repo}.
  base: '/Invoice-Receipt-Maker/',
  plugins: [react()],
})
