import { defineConfig } from 'vite';

export default defineConfig({
  root: './',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          // Keep vendor chunks separated if needed
        }
      }
    }
  },
  server: {
    port: 3000,
    open: true
  }
});
