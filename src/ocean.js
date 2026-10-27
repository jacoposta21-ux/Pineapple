import * as THREE from 'three';
import { SAND_GLSL } from './terrain.js';

const WAVES_GLSL = /* glsl */ `
// Swells rolling towards the beach (-Z). Returns height, writes gradient.
float swell(vec2 p, float t, out vec2 grad) {
  float h = 0.0;
  grad = vec2(0.0);
  vec4 dirs[4];
  dirs[0] = vec4(normalize(vec2(0.15, -1.0)), 0.18, 0.09);   // dir, k, amp
  dirs[1] = vec4(normalize(vec2(-0.35, -1.0)), 0.31, 0.05);
  dirs[2] = vec4(normalize(vec2(0.7, -0.6)), 0.57, 0.025);
  dirs[3] = vec4(normalize(vec2(-0.8, -0.4)), 0.93, 0.014);
  for (int i = 0; i < 4; i++) {
    vec2 d = dirs[i].xy;
    float k = dirs[i].z;
    float a = dirs[i].w;
    float w = sqrt(9.8 * k);
    float ph = dot(d, p) * k - w * t;
    h += a * sin(ph);
    grad += a * k * cos(ph) * d;
  }
  return h;
}

// Fine ripples, only used for shading normals.
vec2 ripples(vec2 p, float t) {
  vec2 g = vec2(0.0);
  g += 0.020 * 2.1 * cos(dot(p, vec2(0.8, 0.6)) * 2.1 + t * 1.7) * vec2(0.8, 0.6);
  g += 0.014 * 3.3 * cos(dot(p, vec2(-0.5, 0.86)) * 3.3 + t * 2.3) * vec2(-0.5, 0.86);
  g += 0.010 * 5.7 * cos(dot(p, vec2(0.96, -0.28)) * 5.7 + t * 3.1) * vec2(0.96, -0.28);
  g += 0.006 * 9.1 * cos(dot(p, vec2(-0.2, -0.98)) * 9.1 + t * 4.2) * vec2(-0.2, -0.98);
  return g;
}
`;

export function createOceanMaterial(sunDir) {
  return new THREE.ShaderMaterial({
    transparent: true,
    fog: true,
    uniforms: THREE.UniformsUtils.merge([
      THREE.UniformsLib.fog,
      {
        uTime: { value: 0 },
        uDisplace: { value: 1 },
        uSunDir: { value: sunDir.clone() },
        uSunColor: { value: new THREE.Color('#fff2d8') },
        uSkyColor: { value: new THREE.Color('#9fd0f0') },
        uHorizon: { value: new THREE.Color('#d6ecf5') },
        uDeep: { value: new THREE.Color('#0b5f8c') },
        uShallow: { value: new THREE.Color('#38d2c8') },
      },
    ]),
    vertexShader: /* glsl */ `
      uniform float uTime;
      uniform float uDisplace;
      varying vec3 vWorld;
      ${SAND_GLSL}
      ${WAVES_GLSL}
      #include <fog_pars_vertex>
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        vec2 g;
        float depth = -sandHeight(world.xz);
        float amp = smoothstep(-0.2, 2.5, depth) * uDisplace;
        world.y += swell(world.xz, uTime, g) * amp;
        vWorld = world.xyz;
        vec4 mvPosition = viewMatrix * world;
        gl_Position = projectionMatrix * mvPosition;
        #include <fog_vertex>
      }
    `,
    fragmentShader: /* glsl */ `
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uSunColor;
      uniform vec3 uSkyColor;
      uniform vec3 uHorizon;
      uniform vec3 uDeep;
      uniform vec3 uShallow;
      varying vec3 vWorld;
      ${SAND_GLSL}
      ${WAVES_GLSL}
      #include <fog_pars_fragment>

      void main() {
        vec2 p = vWorld.xz;
        float depth = -sandHeight(p);
        if (depth < -0.3) discard;

        vec2 g;
        swell(p, uTime, g);
        float calm = smoothstep(-0.2, 2.5, depth);
        g = g * calm + ripples(p, uTime) * (0.4 + 0.6 * calm);
        vec3 n = normalize(vec3(-g.x, 1.0, -g.y));

        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - max(dot(n, viewDir), 0.0), 4.0);
        fres = mix(0.03, 1.0, fres);

        float dist = length(cameraPosition.xz - p);
        vec3 sky = mix(uSkyColor, uHorizon, smoothstep(30.0, 400.0, dist));
        vec3 body = mix(uShallow, uDeep, smoothstep(0.0, 3.5, depth));
        // Subsurface glow on the side of the swells facing the sun.
        body += uShallow * 0.25 * max(0.0, dot(n.xz, -uSunDir.xz)) * calm;

        vec3 col = mix(body, sky, fres);

        vec3 r = reflect(-viewDir, n);
        float spec = pow(max(dot(r, uSunDir), 0.0), 240.0) * 6.0
                   + pow(max(dot(r, uSunDir), 0.0), 24.0) * 0.18;
        col += uSunColor * spec;

        // Shore foam: a static line plus swash that slides up and down the beach.
        float swash = 0.18 + 0.16 * sin(uTime * 0.55 + p.x * 0.05);
        float shore = 1.0 - smoothstep(0.0, swash, depth);
        float pattern = 0.5 + 0.5 * sin(p.x * 3.1 + p.y * 2.3 + uTime * 1.3) * sin(p.x * 1.7 - p.y * 4.1 - uTime);
        float foam = shore * (0.55 + 0.45 * pattern);
        float bands = smoothstep(0.75, 1.0, sin(depth * 6.0 - uTime * 1.6 + p.x * 0.08)) * (1.0 - smoothstep(0.2, 1.2, depth));
        foam = max(foam, bands * 0.45 * (0.5 + 0.5 * pattern));
        col = mix(col, vec3(0.97, 0.99, 1.0), clamp(foam, 0.0, 1.0));

        float alpha = mix(0.55, 0.96, smoothstep(0.0, 1.2, depth));
        alpha = max(alpha, foam);
        alpha *= smoothstep(-0.3, 0.0, depth);

        gl_FragColor = vec4(col, alpha);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        #include <fog_fragment>
      }
    `,
  });
}
