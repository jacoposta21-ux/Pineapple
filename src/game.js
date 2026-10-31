import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWorld } from './world.js';
import { sandHeight } from './terrain.js';
import { BeachAudio } from './audio.js';
import * as platform from './platform.js';
import { translate } from './i18n.js';

const MODES = { MENU: 'menu', ARCADE: 'arcade', REALISTIC: 'realistic' };
const LONG_PRESS_MS = 1500;

const lowPower =
  window.matchMedia('(pointer: coarse)').matches || Math.min(window.innerWidth, window.innerHeight) < 600;

// ---------- Renderer / camera ----------
const stage = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ antialias: !lowPower || window.devicePixelRatio < 2, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, lowPower ? 1.5 : 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.6;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
stage.appendChild(renderer.domElement);

const camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 12000);
const world = createWorld(renderer, { lowPower });

// The camera orbits the pineapple. The pineapple orbits nothing. It just is.
const controls = new OrbitControls(camera, renderer.domElement);
controls.target.copy(world.focus);
controls.enablePan = false;
controls.enableDamping = true;
controls.dampingFactor = 0.07;
controls.rotateSpeed = 0.55;
controls.zoomSpeed = 0.8;
controls.minDistance = 1.4;
controls.maxDistance = 14;
controls.minPolarAngle = 0.12;
controls.maxPolarAngle = THREE.MathUtils.degToRad(84);
controls.touches = { ONE: THREE.TOUCH.ROTATE, TWO: THREE.TOUCH.DOLLY_ROTATE };
controls.autoRotateSpeed = 0.5;

const startOffset = new THREE.Vector3().setFromSphericalCoords(4.6, 1.2, Math.PI + 0.75);
camera.position.copy(world.focus).add(startOffset);
camera.lookAt(world.focus);

// ---------- Audio ----------
const audio = new BeachAudio();
let soundOn = true; // the player's own choice (menu / HUD button)
let platformMuted = false; // the portal asked for silence
let paused = false; // the portal paused the game (ads, overlays, tab hidden)

// The beach is heard only in Arcade Mode, and only when nobody objects.
function syncAudio() {
  audio.setMuted(!soundOn || platformMuted);
  if (mode === MODES.ARCADE && !paused && !document.hidden) audio.play();
  else audio.silence(); // Menu is quiet; Realistic Mode has no ears.
}

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const menuEl = $('menu');
const hudEl = $('hud');
const voidEl = $('void');
const btnSound = $('btn-sound');
const hudSound = $('hud-sound');
let t = translate('en');

function refreshSoundUI() {
  btnSound.textContent = soundOn ? t.soundOn : t.soundOff;
  btnSound.setAttribute('aria-pressed', String(soundOn));
  hudSound.classList.toggle('muted', !soundOn);
}

function toggleSound() {
  soundOn = !soundOn;
  platform.saveSoundSetting(soundOn);
  refreshSoundUI();
  syncAudio();
}

function applyLanguage(lang) {
  t = translate(lang);
  document.documentElement.lang = t.lang;
  $('btn-arcade').textContent = t.arcade;
  $('btn-realistic').textContent = t.realistic;
  $('hud-menu').setAttribute('aria-label', t.menu);
  hudSound.setAttribute('aria-label', t.sound);
  refreshSoundUI();
}

// ---------- Modes ----------
let mode = null;

function setMode(next) {
  if (next === mode) return;
  const previous = mode;
  mode = next;
  document.activeElement?.blur?.();

  menuEl.classList.toggle('hidden', mode !== MODES.MENU);
  hudEl.classList.toggle('hidden', mode !== MODES.ARCADE);
  voidEl.classList.toggle('hidden', mode !== MODES.REALISTIC);
  document.body.classList.toggle('realistic', mode === MODES.REALISTIC);

  controls.enabled = mode === MODES.ARCADE;
  controls.autoRotate = mode === MODES.MENU;

  syncAudio();

  if (mode === MODES.MENU) {
    platform.gameplayStop();
    // Back at the menu is the natural pause; the portal decides if an ad shows.
    if (previous) platform.showInterstitial();
  } else {
    platform.gameplayStart();
  }

  if (mode === MODES.REALISTIC) cancelLongPress();
}

$('btn-arcade').addEventListener('click', () => setMode(MODES.ARCADE));
$('btn-realistic').addEventListener('click', () => setMode(MODES.REALISTIC));
btnSound.addEventListener('click', toggleSound);
hudSound.addEventListener('click', toggleSound);
$('hud-menu').addEventListener('click', () => setMode(MODES.MENU));

window.addEventListener('keydown', (e) => {
  // Esc may be taken by the browser or the portal (full screen), so Backspace works too.
  if (e.key === 'Escape' || e.key === 'Esc' || e.key === 'Backspace') {
    if (mode !== MODES.MENU) {
      e.preventDefault();
      setMode(MODES.MENU);
    }
    return;
  }
  // Keep the page (and the portal's iframe host) from scrolling.
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)) {
    if (e.target === document.body || mode !== MODES.MENU) e.preventDefault();
  }
});

// Invisible exit for touch screens and mice: press and hold anywhere in the dark.
let longPressTimer = 0;
function cancelLongPress() {
  clearTimeout(longPressTimer);
  longPressTimer = 0;
}
voidEl.addEventListener('pointerdown', () => {
  cancelLongPress();
  longPressTimer = setTimeout(() => setMode(MODES.MENU), LONG_PRESS_MS);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((type) => voidEl.addEventListener(type, cancelLongPress));

window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });
document.addEventListener('visibilitychange', syncAudio);

window.addEventListener('resize', () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
});

// ---------- Loop ----------
// The simulation keeps running in every mode. In Realistic Mode it simply
// isn't drawn: the pineapple has no eyes.
const timer = new THREE.Timer();
let elapsed = 0;

function keepCameraAboveGround() {
  const minY = Math.max(sandHeight(camera.position.x, camera.position.z), 0) + 0.25;
  if (camera.position.y < minY) {
    camera.position.y = minY;
    camera.lookAt(controls.target);
  }
}

function frame() {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  if (paused) return;
  elapsed += dt;
  world.update(elapsed);

  if (mode === MODES.REALISTIC) return;

  controls.update(dt);
  keepCameraAboveGround();
  audio.update(dt);
  renderer.render(world.scene, camera);
}

// ---------- Start ----------
async function start() {
  applyLanguage(platform.language());
  soundOn = await platform.loadSoundSetting();
  platformMuted = !platform.isAudioEnabled();
  paused = platform.isPaused();
  platform.onAudioStateChanged((muted) => {
    platformMuted = muted;
    syncAudio();
  });
  platform.onPauseStateChanged((p) => {
    paused = p;
    syncAudio();
  });
  platform.onAdStateChanged((open) => {
    paused = open || platform.isPaused();
    syncAudio();
  });

  refreshSoundUI();
  setMode(MODES.MENU);
  frame();
  renderer.setAnimationLoop(frame);
  platform.gameReady();
}

start();

// Expose a tiny debug handle for automated checks.
window.__pineapple = { getMode: () => mode, setMode, camera, controls, audio, world, MODES };
