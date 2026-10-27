import * as THREE from 'three';

/**
 * Builds a folded, tapered ribbon that curves in its local XY plane
 * (X = outward, Y = up). Used for pineapple crown leaves and palm fronds.
 */
export function leafGeometry({
  length = 1,
  width = 0.1,
  tilt = 0.3, // angle from vertical at the base (radians)
  bend = 0.6, // extra angle gained towards the tip (droop)
  fold = 0.35, // V-fold depth, relative to width
  segments = 10,
  serration = 0, // 0..1, zig-zag edges (palm leaflets)
  baseColor = new THREE.Color('#4f8a4a'),
  tipColor = new THREE.Color('#2f5e35'),
}) {
  const positions = [];
  const colors = [];
  const indices = [];
  const step = length / segments;

  let x = 0;
  let y = 0;
  const c = new THREE.Color();

  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const a = tilt + bend * t * t;
    const dirX = Math.sin(a);
    const dirY = Math.cos(a);
    // Normal of the centre line within the XY plane.
    const nX = -dirY;
    const nY = dirX;

    let w = width * Math.pow(1 - t, 0.9) * Math.min(1, 0.35 + t * 4);
    if (serration > 0 && i % 2 === 1) w *= 1 - serration;
    const lift = -fold * w;

    positions.push(x + nX * lift, y + nY * lift, -w / 2);
    positions.push(x, y, 0);
    positions.push(x + nX * lift, y + nY * lift, w / 2);

    c.copy(baseColor).lerp(tipColor, t);
    for (let k = 0; k < 3; k++) {
      const shade = k === 1 ? 1.08 : 0.92;
      colors.push(c.r * shade, c.g * shade, c.b * shade);
    }

    if (i < segments) {
      const r = i * 3;
      indices.push(r, r + 1, r + 3, r + 1, r + 4, r + 3, r + 1, r + 2, r + 4, r + 2, r + 5, r + 4);
    }

    x += dirX * step;
    y += dirY * step;
  }

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}
