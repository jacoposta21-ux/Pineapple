import './style.css';
import { initPlatform } from './platform.js';

// The portal SDK comes first; the game (renderer, world, audio) is loaded only
// once it is ready.
initPlatform().then(() => import('./game.js'));
