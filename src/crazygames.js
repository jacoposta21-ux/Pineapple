// Thin, optional bridge to the CrazyGames SDK v3. Nothing here loads remote
// code: if the platform provides `window.CrazyGames.SDK`, gameplay events are
// reported to it; otherwise every call is a no-op. No ads are requested.

let sdk = null;
let inGameplay = false;

export async function initPlatform() {
  try {
    const candidate = window.CrazyGames && window.CrazyGames.SDK;
    if (!candidate) return;
    await candidate.init();
    sdk = candidate;
  } catch {
    sdk = null;
  }
}

export function gameplayStart() {
  if (!sdk || inGameplay) return;
  inGameplay = true;
  try {
    sdk.game.gameplayStart();
  } catch {
    /* ignore */
  }
}

export function gameplayStop() {
  if (!sdk || !inGameplay) return;
  inGameplay = false;
  try {
    sdk.game.gameplayStop();
  } catch {
    /* ignore */
  }
}
