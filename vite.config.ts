import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  // Relative asset paths, so the build works at any subpath
  // (GitHub Pages serves it from /APOD-project/). All routes are query strings.
  base: './',
  plugins: [react()],
})
