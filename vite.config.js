import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 8081,
    strictPort: true,
    open: false
  },
  preview: {
    port: 8081,
    strictPort: true
  },
  build: {
    outDir: 'dist',
    sourcemap: true,
    target: 'es2020'
  }
});
