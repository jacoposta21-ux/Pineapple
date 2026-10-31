import { defineConfig } from 'vite';
import playgamaBridge from '@playgama/bridge/vite';

// Relative base so the build works from any folder, as both portals require.
//   npm run build           -> dist/           (CrazyGames, no SDK bundled)
//   npm run build:playgama  -> dist-playgama/  (Playgama Bridge SDK + its config)
export default defineConfig(({ mode }) => {
  const playgama = mode === 'playgama';
  return {
    base: './',
    publicDir: playgama ? 'public-playgama' : false,
    plugins: playgama ? [playgamaBridge({ mode: 'cdn' })] : [],
    build: {
      outDir: playgama ? 'dist-playgama' : 'dist',
      target: 'es2020',
      assetsInlineLimit: 0,
      chunkSizeWarningLimit: 1200,
    },
  };
});
