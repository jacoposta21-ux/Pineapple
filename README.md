# Pineapple Simulator

You are a pineapple on a beach. You cannot walk, jump, roll or move.

Browser game built with JavaScript, Three.js and Vite, targeting CrazyGames.

## Modes

- **Arcade Mode**: a 3D tropical beach (ocean, sky, sun, palms). The pineapple stays still and you orbit the camera around it.
  - Mouse: drag to rotate (full 360° horizontally, limited vertically), wheel to zoom.
  - Touch: drag with one finger to rotate, pinch to zoom.
  - `ESC` or the ☰ button returns to the menu. The 🔊 button toggles sound.
- **Realistic Mode**: pineapples have no eyes and no ears. The screen is pure black and there is no sound at all.
  - Hidden exit: `ESC` (desktop) or press and hold anywhere for 1.5 s (touch).

## Development

```bash
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
npm run preview  # serve the production build
```

## CrazyGames

- `vite.config.js` uses `base: './'`, so `dist/` can be zipped and uploaded as is.
- No backend, no external APIs, no remote assets: textures and audio are generated procedurally at runtime.
- `src/crazygames.js` reports `gameplayStart` / `gameplayStop` to the CrazyGames SDK v3 **only if** the page already provides `window.CrazyGames.SDK`. To enable it, add `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` to `index.html` before the module script. No ads are requested.
