# Pineapple Simulator

You are a pineapple on a beach. You cannot walk, jump, roll or move.

Browser game built with JavaScript, Three.js and Vite, targeting CrazyGames.

## Modes

- **Arcade Mode**: a 3D tropical beach (ocean, sky, sun, palms). The pineapple stays still and you orbit the camera around it.
  - Mouse: drag to rotate (full 360° horizontally, limited vertically), wheel to zoom.
  - Touch: drag with one finger to rotate, pinch to zoom.
  - `ESC` or the ☰ button returns to the menu. The 🔊 button toggles sound.
- **Realistic Mode**: pineapples have no eyes and no ears. The screen is pure black and there is no sound at all.
  - Hidden exit: `ESC` or `Backspace` (desktop), or press and hold anywhere for 1.5 s (mouse or touch).

## Development

```bash
npm install
npm run dev              # local dev server
npm run build            # CrazyGames build in dist/
npm run build:playgama   # Playgama build in dist-playgama/
npm run preview          # serve dist/ (preview:playgama serves dist-playgama/)
```

## CrazyGames

- `vite.config.js` uses `base: './'`, so `dist/` can be zipped and uploaded as is.
- No backend, no external APIs, no remote assets: textures and audio are generated procedurally at runtime.
- `src/platform.js` reports `gameplayStart` / `gameplayStop` to the CrazyGames SDK v3 **only if** the page already provides `window.CrazyGames.SDK`. To enable it, add `<script src="https://sdk.crazygames.com/crazygames-sdk-v3.js"></script>` to `index.html` before the module script. No ads are requested.

## Playgama

`npm run build:playgama` produces `dist-playgama/` with the [Playgama Bridge SDK](https://www.npmjs.com/package/@playgama/bridge) (2.4.0):

- `index.html` loads Bridge first from the Playgama CDN (with a local `playgama-bridge.js` fallback), and the game code is loaded only after `bridge.initialize()` resolves.
- `playgama-bridge-config.json` (from `public-playgama/`) sits beside `index.html`. It is empty: edit it with the [config editor](https://playgama.github.io/bridge-config-editor/) if needed.
- `game_ready` is sent once the menu is on screen; `gameplay_started` / `gameplay_stopped` follow the modes.
- The platform's audio and pause states are respected (`isAudioEnabled`, `AUDIO_STATE_CHANGED`, `PAUSE_STATE_CHANGED`): the game freezes and goes silent when asked.
- The sound preference is saved through Bridge Storage (no `localStorage` in this build).
- Menu labels follow `platform.language` (en, it, es, fr, de, pt, ru, tr; English fallback).
- Returning to the menu is the natural pause where `showInterstitial()` is called; Bridge decides whether an ad actually shows. Ads never interrupt Arcade or Realistic Mode. The CrazyGames build requests no ads.
