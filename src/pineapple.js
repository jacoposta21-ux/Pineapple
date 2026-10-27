import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { leafGeometry } from './leaf.js';

// Diamond lattice of pineapple "eyes" in UV space.
// N diamonds around, M controls vertical size (chosen so diamonds look square).
const N = 16;
const M = 6;

function hash(a, b) {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
}

// Returns { bump: 0..1 (1 = centre of a scale), ca, cb (cell ids), fa, fb }.
function scaleAt(u, v) {
  const a = u * N + v * M;
  const b = u * N - v * M;
  const ca = Math.floor(a);
  const cb = Math.floor(b);
  const fa = a - ca;
  const fb = b - cb;
  const bump = 1 - Math.max(Math.abs(fa - 0.5), Math.abs(fb - 0.5)) * 2;
  return { bump, ca, cb, fa, fb };
}

function makeSkinTexture() {
  const W = 1024;
  const H = 512;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;

  const seam = [70, 52, 18];
  const gold = [226, 160, 40];
  const amber = [200, 112, 26];
  const green = [150, 150, 48];
  const tip = [92, 58, 22];

  for (let y = 0; y < H; y++) {
    const v = 1 - y / H; // canvas top = geometry top
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const { bump, ca, cb, fa, fb } = scaleAt(u, v);
      const r = hash(ca, cb);

      // Base colour per scale: golden, amber towards the bottom, greener at top.
      let col = mix3(gold, amber, 0.25 + 0.5 * r * (1 - v));
      col = mix3(col, green, smooth(0.55, 1.0, v) * 0.55 + (r > 0.85 ? 0.25 : 0));

      // Darker seams between scales.
      const s = smooth(0.0, 0.22, bump);
      col = mix3(seam, col, s);

      // Little brown spike on the lower part of each eye.
      const tx = (fa + fb) * 0.5 - 0.5;
      const ty = (fa - fb) * 0.5 + 0.18;
      const tipD = Math.hypot(tx * 1.3, ty);
      col = mix3(col, tip, (1 - smooth(0.04, 0.1, tipD)) * 0.85);

      // Soft highlight towards the top of each scale.
      const hl = smooth(0.4, 0.95, bump) * smooth(-0.2, 0.3, -ty) * 0.18;
      col = [col[0] + 255 * hl * 0.6, col[1] + 255 * hl * 0.45, col[2] + 255 * hl * 0.1];

      const n = (hash(x, y) - 0.5) * 14;
      const i = (y * W + x) * 4;
      d[i] = clamp255(col[0] + n);
      d[i + 1] = clamp255(col[1] + n);
      d[i + 2] = clamp255(col[2] + n * 0.5);
      d[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

function makeBodyGeometry(radius, height) {
  const pts = [];
  const steps = 48;
  const a = height / 2;
  pts.push(new THREE.Vector2(0, -0.9 * a));
  for (let i = 0; i <= steps; i++) {
    const u = -0.9 + (1.78 * i) / steps;
    const r = radius * Math.sqrt(Math.max(0, 1 - u * u)) * (1 - 0.07 * u);
    pts.push(new THREE.Vector2(Math.max(r, 0.001), u * a));
  }
  pts.push(new THREE.Vector2(0, 0.88 * a));

  const geo = new THREE.LatheGeometry(pts, 96);
  geo.computeVertexNormals();

  // Push each scale outward so the surface has real relief.
  const pos = geo.attributes.position;
  const uv = geo.attributes.uv;
  const nor = geo.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    const edge = Math.min(1, Math.min(v, 1 - v) * 12);
    const { bump } = scaleAt(u, v);
    const h = Math.pow(Math.max(0, bump), 0.6) * 0.022 * edge;
    pos.setXYZ(
      i,
      pos.getX(i) + nor.getX(i) * h,
      pos.getY(i) + nor.getY(i) * h,
      pos.getZ(i) + nor.getZ(i) * h,
    );
  }
  geo.computeVertexNormals();
  return geo;
}

function makeCrownGeometry() {
  const rings = [
    { count: 9, tilt: 1.0, bend: 0.75, length: 0.42, width: 0.095 },
    { count: 8, tilt: 0.7, bend: 0.6, length: 0.55, width: 0.09 },
    { count: 7, tilt: 0.42, bend: 0.5, length: 0.66, width: 0.085 },
    { count: 6, tilt: 0.2, bend: 0.4, length: 0.62, width: 0.075 },
    { count: 4, tilt: 0.05, bend: 0.25, length: 0.45, width: 0.06 },
  ];
  const parts = [];
  const base = new THREE.Color('#7fae5a');
  const tipC = new THREE.Color('#2e6a4a');
  const m = new THREE.Matrix4();
  rings.forEach((ring, k) => {
    for (let i = 0; i < ring.count; i++) {
      const jitter = hash(k * 13 + i, 7);
      const g = leafGeometry({
        length: ring.length * (0.85 + 0.3 * jitter),
        width: ring.width,
        tilt: ring.tilt + (jitter - 0.5) * 0.2,
        bend: ring.bend,
        fold: 0.45,
        segments: 9,
        baseColor: base,
        tipColor: tipC.clone().offsetHSL((jitter - 0.5) * 0.04, 0, (jitter - 0.5) * 0.06),
      });
      const phi = (i / ring.count) * Math.PI * 2 + k * 0.7 + jitter * 0.3;
      m.makeRotationY(phi);
      g.applyMatrix4(m);
      parts.push(g);
    }
  });
  return mergeGeometries(parts);
}

/** The protagonist. It does nothing. That is the point. */
export function createPineapple(position) {
  const group = new THREE.Group();
  group.name = 'Pineapple';

  const radius = 0.36;
  const height = 0.92;

  const body = new THREE.Mesh(
    makeBodyGeometry(radius, height),
    new THREE.MeshStandardMaterial({ map: makeSkinTexture(), roughness: 0.72, metalness: 0 }),
  );
  body.position.y = height * 0.45;
  body.castShadow = true;
  body.receiveShadow = true;
  group.add(body);

  // Short stem collar between body and crown.
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.13, 0.07, 16),
    new THREE.MeshStandardMaterial({ color: '#6c7b33', roughness: 0.9 }),
  );
  collar.position.y = body.position.y + height * 0.44;
  collar.castShadow = true;
  group.add(collar);

  const crown = new THREE.Mesh(
    makeCrownGeometry(),
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      roughness: 0.55,
      side: THREE.DoubleSide,
    }),
  );
  crown.position.y = collar.position.y + 0.02;
  crown.castShadow = true;
  crown.receiveShadow = true;
  group.add(crown);

  // Slightly sunk and tilted, as if it has been sitting here forever.
  group.position.copy(position).y -= 0.03;
  group.rotation.set(0.04, 0.6, -0.03);
  group.userData.focusHeight = 0.55;

  // Make it impossible to move: freeze the transform.
  group.traverse((o) => {
    o.updateMatrix();
    o.matrixAutoUpdate = false;
  });
  group.updateMatrixWorld(true);
  return group;
}

function mix3(a, b, t) {
  t = Math.min(1, Math.max(0, t));
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
}

function smooth(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function clamp255(x) {
  return x < 0 ? 0 : x > 255 ? 255 : x;
}
