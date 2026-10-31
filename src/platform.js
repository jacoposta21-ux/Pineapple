// One small facade over the portals the game ships to.
//
// - Playgama build (`npm run build:playgama`): the Playgama Bridge SDK is loaded
//   by index.html before the game and handles saves, pause/audio, lifecycle
//   messages and interstitial ads.
// - CrazyGames build (`npm run build`): if the page provides the CrazyGames SDK
//   v3, gameplay start/stop is reported to it. No ads are requested.
// - Anywhere else every call is a harmless no-op.

const PLAYGAMA = import.meta.env.MODE === 'playgama';
const SOUND_KEY = 'pineapple-sound';

let bridge = null;
let crazy = null;
let inGameplay = false;

export async function initPlatform() {
  if (PLAYGAMA) {
    const candidate = window.bridge;
    if (!candidate) return;
    try {
      await candidate.initialize();
      bridge = candidate;
    } catch {
      bridge = null;
    }
    return;
  }
  try {
    const candidate = window.CrazyGames && window.CrazyGames.SDK;
    if (!candidate) return;
    await candidate.init();
    crazy = candidate;
  } catch {
    crazy = null;
  }
}

export function language() {
  return (bridge ? bridge.platform.language : navigator.language || 'en').slice(0, 2).toLowerCase();
}

export function isAudioEnabled() {
  return bridge ? bridge.platform.isAudioEnabled !== false : true;
}

export function isPaused() {
  return bridge ? bridge.platform.isPaused === true : false;
}

/** Calls back with `true` when the platform wants the game silent. */
export function onAudioStateChanged(cb) {
  if (bridge) bridge.platform.on(bridge.EVENT_NAME.AUDIO_STATE_CHANGED, (enabled) => cb(!enabled));
}

/** Calls back with `true` when the platform pauses the game. */
export function onPauseStateChanged(cb) {
  if (bridge) bridge.platform.on(bridge.EVENT_NAME.PAUSE_STATE_CHANGED, (paused) => cb(!!paused));
}

/** Calls back with `true` while an interstitial ad is on screen. */
export function onAdStateChanged(cb) {
  if (!bridge) return;
  bridge.advertisement.on(bridge.EVENT_NAME.INTERSTITIAL_STATE_CHANGED, (state) => {
    if (state === 'opened') cb(true);
    else if (state === 'closed' || state === 'failed') cb(false);
  });
}

export async function loadSoundSetting() {
  if (bridge) {
    try {
      const [sound] = await bridge.storage.get([SOUND_KEY]);
      return sound !== 'off';
    } catch {
      return true;
    }
  }
  if (PLAYGAMA) return true;
  try {
    return localStorage.getItem(SOUND_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function saveSoundSetting(on) {
  const value = on ? 'on' : 'off';
  if (bridge) {
    bridge.storage.set([SOUND_KEY], [value]).catch(() => {});
    return;
  }
  if (PLAYGAMA) return;
  try {
    localStorage.setItem(SOUND_KEY, value);
  } catch {
    /* storage unavailable */
  }
}

export function gameReady() {
  if (bridge) bridge.platform.sendMessage('game_ready').catch(() => {});
}

export function gameplayStart() {
  if (inGameplay) return;
  inGameplay = true;
  if (bridge) bridge.platform.sendMessage('gameplay_started').catch(() => {});
  try {
    crazy?.game.gameplayStart();
  } catch {
    /* ignore */
  }
}

export function gameplayStop() {
  if (!inGameplay) return;
  inGameplay = false;
  if (bridge) bridge.platform.sendMessage('gameplay_stopped').catch(() => {});
  try {
    crazy?.game.gameplayStop();
  } catch {
    /* ignore */
  }
}

/** A natural pause (back to the menu). Bridge decides whether an ad actually shows. */
export function showInterstitial() {
  if (bridge) bridge.advertisement.showInterstitial();
}
