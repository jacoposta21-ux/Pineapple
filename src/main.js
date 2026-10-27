import './style.css';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { createWorld } from './world.js';
import { sandHeight } from './terrain.js';
import { BeachAudio } from './audio.js';
import { initPlatform, gameplayStart, gameplayStop } from './crazygames.js';

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
let soundOn = true;
try {
  soundOn = localStorage.getItem('pineapple-sound') !== 'off';
} catch {
  /* storage unavailable */
}
audio.setMuted(!soundOn);

// ---------- UI ----------
const $ = (id) => document.getElementById(id);
const menuEl = $('menu');
const hudEl = $('hud');
const voidEl = $('void');
const btnSound = $('btn-sound');
const hudSound = $('hud-sound');

function refreshSoundUI() {
  btnSound.textContent = soundOn ? 'Sound: On' : 'Sound: Off';
  btnSound.setAttribute('aria-pressed', String(soundOn));
  hudSound.classList.toggle('muted', !soundOn);
}

function toggleSound() {
  soundOn = !soundOn;
  audio.setMuted(!soundOn);
  try {
    localStorage.setItem('pineapple-sound', soundOn ? 'on' : 'off');
  } catch {
    /* storage unavailable */
  }
  refreshSoundUI();
}
refreshSoundUI();

// ---------- Modes ----------
let mode = null;

function setMode(next) {
  if (next === mode) return;
  mode = next;
  document.activeElement?.blur?.();

  menuEl.classList.toggle('hidden', mode !== MODES.MENU);
  hudEl.classList.toggle('hidden', mode !== MODES.ARCADE);
  voidEl.classList.toggle('hidden', mode !== MODES.REALISTIC);
  document.body.classList.toggle('realistic', mode === MODES.REALISTIC);

  controls.enabled = mode === MODES.ARCADE;
  controls.autoRotate = mode === MODES.MENU;

  if (mode === MODES.ARCADE) audio.play();
  else audio.silence(); // Menu is quiet; Realistic Mode has no ears.

  if (mode === MODES.MENU) gameplayStop();
  else gameplayStart();

  if (mode === MODES.REALISTIC) cancelLongPress();
}

$('btn-arcade').addEventListener('click', () => setMode(MODES.ARCADE));
$('btn-realistic').addEventListener('click', () => setMode(MODES.REALISTIC));
btnSound.addEventListener('click', toggleSound);
hudSound.addEventListener('click', toggleSound);
$('hud-menu').addEventListener('click', () => setMode(MODES.MENU));

window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' || e.key === 'Esc') {
    if (mode !== MODES.MENU) {
      e.preventDefault();
      setMode(MODES.MENU);
    }
    return;
  }
  // Keep the page (and the CrazyGames iframe host) from scrolling.
  if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'PageUp', 'PageDown'].includes(e.key)) {
    if (e.target === document.body || mode !== MODES.MENU) e.preventDefault();
  }
});

// Invisible exit for touch screens: press and hold anywhere in the dark.
let longPressTimer = 0;
function cancelLongPress() {
  clearTimeout(longPressTimer);
  longPressTimer = 0;
}
voidEl.addEventListener('pointerdown', () => {
  cancelLongPress();
  longPressTimer = setTimeout(() => setMode(MODES.MENU), LONG_PRESS_MS);
});
['pointerup', 'pointercancel', 'pointerleave'].forEach((t) => voidEl.addEventListener(t, cancelLongPress));

window.addEventListener('contextmenu', (e) => e.preventDefault());
window.addEventListener('wheel', (e) => e.preventDefault(), { passive: false });

document.addEventListener('visibilitychange', () => {
  if (document.hidden) audio.silence();
  else if (mode === MODES.ARCADE) audio.play();
});

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

renderer.setAnimationLoop(() => {
  timer.update();
  const dt = Math.min(timer.getDelta(), 0.1);
  elapsed += dt;
  world.update(elapsed);

  if (mode === MODES.REALISTIC) return;

  controls.update(dt);
  keepCameraAboveGround();
  audio.update(dt);
  renderer.render(world.scene, camera);
});

setMode(MODES.MENU);
initPlatform();

// Expose a tiny debug handle for automated checks.
window.__pineapple = { getMode: () => mode, setMode, camera, controls, audio, world, MODES };
