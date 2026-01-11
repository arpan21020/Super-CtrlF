import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  build: {  
    rollupOptions: {
      input: {
        main: 'index.html',
        background: 'src/background/index.js',
        content: 'src/content/index.js',
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
    outDir: 'dist',
  },
  plugins: [react()],
})
