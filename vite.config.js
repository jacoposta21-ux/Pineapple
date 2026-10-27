import { defineConfig } from 'vite';

// Relative base so the build works from any folder (required by CrazyGames uploads).
export default defineConfig({
  base: './',
  build: {
    target: 'es2020',
    assetsInlineLimit: 0,
    chunkSizeWarningLimit: 1200,
  },
});
