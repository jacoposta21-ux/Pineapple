// Shared beach height function. The same formula is mirrored in the ocean
// shader (see SAND_GLSL) so the water knows how deep it is for foam & colour.
// Ocean lies towards +Z, the water surface rests at y = 0.

export const PINEAPPLE_POS = { x: 0, z: 0 };

export function sandHeight(x, z) {
  const slope = 0.35 - 0.05 * (z - 0.6 * Math.sin(x * 0.06));
  const dunes = smoothstep(-14, -40, z) * 3.2 * (0.7 + 0.3 * Math.sin(x * 0.09));
  const ripples =
    0.08 * Math.sin(0.35 * x + 0.2 * z) * Math.cos(0.27 * z - 0.15 * x) +
    0.025 * Math.sin(1.3 * x + 0.7 * z);
  // Keep the pineapple's spot nicely flat.
  const d = Math.hypot(x - PINEAPPLE_POS.x, z - PINEAPPLE_POS.z);
  const flat = smoothstep(0.6, 2.5, d);
  return slope + dunes + ripples * flat;
}

function smoothstep(a, b, x) {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export const SAND_GLSL = /* glsl */ `
float sandHeight(vec2 p) {
  float slope = 0.35 - 0.05 * (p.y - 0.6 * sin(p.x * 0.06));
  float dunes = (1.0 - smoothstep(-40.0, -14.0, p.y)) * 3.2 * (0.7 + 0.3 * sin(p.x * 0.09));
  float ripples = 0.08 * sin(0.35 * p.x + 0.2 * p.y) * cos(0.27 * p.y - 0.15 * p.x)
                + 0.025 * sin(1.3 * p.x + 0.7 * p.y);
  float flatK = smoothstep(0.6, 2.5, length(p));
  return slope + dunes + ripples * flatK;
}
`;
