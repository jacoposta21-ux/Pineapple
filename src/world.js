import * as THREE from 'three';
import { Sky } from 'three/examples/jsm/objects/Sky.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { sandHeight, PINEAPPLE_POS } from './terrain.js';
import { createOceanMaterial } from './ocean.js';
import { createPineapple } from './pineapple.js';
import { leafGeometry } from './leaf.js';

const FOG_COLOR = '#bcdcee';

export function createWorld(renderer, { lowPower = false } = {}) {
  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2(FOG_COLOR, 0.0009);

  // ---------- Sun & sky ----------
  const sunDir = new THREE.Vector3().setFromSphericalCoords(
    1,
    THREE.MathUtils.degToRad(90 - 38),
    THREE.MathUtils.degToRad(62),
  );

  const sky = new Sky();
  sky.scale.setScalar(9000);
  const su = sky.material.uniforms;
  su.turbidity.value = 2.2;
  su.rayleigh.value = 1.8;
  su.mieCoefficient.value = 0.004;
  su.mieDirectionalG.value = 0.82;
  su.sunPosition.value.copy(sunDir);
  if (su.cloudCoverage) {
    su.cloudCoverage.value = 0.3;
    su.cloudDensity.value = 0.45;
    su.cloudElevation.value = 0.55;
  }
  scene.add(sky);

  // Image based lighting baked once from the sky.
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  const envSky = new Sky();
  envSky.scale.setScalar(100);
  Object.entries(su).forEach(([k, u]) => {
    if (envSky.material.uniforms[k]) envSky.material.uniforms[k].value = u.value;
  });
  if (envSky.material.uniforms.showSunDisc) envSky.material.uniforms.showSunDisc.value = 0;
  envScene.add(envSky);
  scene.environment = pmrem.fromScene(envScene, 0, 0.1, 200).texture;
  scene.environmentIntensity = 0.35;
  pmrem.dispose();

  const sun = new THREE.DirectionalLight('#fff0d4', 3.2);
  sun.position.copy(sunDir).multiplyScalar(40);
  sun.castShadow = true;
  sun.shadow.mapSize.setScalar(lowPower ? 1024 : 2048);
  const sc = sun.shadow.camera;
  sc.left = -16;
  sc.right = 16;
  sc.top = 16;
  sc.bottom = -16;
  sc.near = 1;
  sc.far = 100;
  sun.shadow.bias = -0.0004;
  sun.shadow.normalBias = 0.03;
  scene.add(sun, sun.target);

  scene.add(new THREE.HemisphereLight('#bfe2ff', '#e9d2a2', 0.3));

  // ---------- Sand ----------
  scene.add(createSand(220, lowPower ? 200 : 300, -30, 0));
  scene.add(createSand(4000, 80, -1500, -0.25));

  // ---------- Ocean ----------
  const oceanMat = createOceanMaterial(sunDir);
  const nearOcean = new THREE.Mesh(new THREE.PlaneGeometry(320, 320, lowPower ? 160 : 260, lowPower ? 160 : 260), oceanMat);
  nearOcean.rotation.x = -Math.PI / 2;
  nearOcean.position.z = 120;
  nearOcean.renderOrder = 2;
  scene.add(nearOcean);

  const farOcean = new THREE.Mesh(new THREE.RingGeometry(150, 9000, 64, 1), oceanMat);
  farOcean.rotation.x = -Math.PI / 2;
  farOcean.position.set(0, -0.03, 120);
  farOcean.renderOrder = 1;
  scene.add(farOcean);

  // ---------- Pineapple (the star) ----------
  const pineapplePos = new THREE.Vector3(PINEAPPLE_POS.x, sandHeight(PINEAPPLE_POS.x, PINEAPPLE_POS.z), PINEAPPLE_POS.z);
  const pineapple = createPineapple(pineapplePos);
  scene.add(pineapple);
  scene.add(contactShadow(pineapplePos, 0.55));

  // ---------- Props ----------
  const palms = [
    createPalm(-6.5, -4.5, 6.8, 0.25, 1.2),
    createPalm(7.5, -8, 7.6, -0.3, 4.1),
    createPalm(-13, -13, 8.4, 0.15, 2.3),
    createPalm(16, -3, 6.4, -0.2, 0.4),
    createPalm(-22, -2, 7.2, 0.3, 5.0),
    createPalm(25, -16, 9, -0.1, 3.3),
    createPalm(2, -24, 8, 0.05, 1.9),
  ];
  palms.forEach((p) => scene.add(p));

  scene.add(createRocks());
  scene.add(createCoconut(2.6, -1.4));
  scene.add(createStarfish(1.4, 1.7, 0.4));
  scene.add(createStarfish(-3.2, 4.6, 2.1));
  scene.add(createShells());
  scene.add(createIslands());

  const focus = pineapplePos.clone();
  focus.y += pineapple.userData.focusHeight;

  function update(time) {
    oceanMat.uniforms.uTime.value = time;
    if (su.time) su.time.value = time;
    for (const p of palms) {
      const crown = p.userData.crown;
      const ph = p.userData.phase;
      crown.rotation.z = Math.sin(time * 0.7 + ph) * 0.025;
      crown.rotation.x = Math.sin(time * 0.53 + ph * 1.7) * 0.02;
    }
  }

  return { scene, update, focus, sunDir };
}

function createSand(size, seg, offsetZ, offsetY) {
  const geo = new THREE.PlaneGeometry(size, size, seg, seg);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, offsetZ);
  const pos = geo.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const dry = new THREE.Color('#eec98a');
  const dune = new THREE.Color('#e8c17c');
  const wet = new THREE.Color('#b8925e');
  const under = new THREE.Color('#b69a6b');
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getZ(i);
    const h = sandHeight(x, z);
    pos.setY(i, h + offsetY);
    if (h < 0) c.copy(wet).lerp(under, Math.min(1, -h / 1.5));
    else c.copy(wet).lerp(dry, Math.min(1, h / 0.35)).lerp(dune, Math.min(1, Math.max(0, h - 0.8) / 2));
    const n = (Math.sin(x * 12.9898 + z * 78.233) * 43758.5453) % 1;
    c.offsetHSL(0, 0, n * 0.02);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geo.computeVertexNormals();

  const mat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.96,
    metalness: 0,
    map: sandGrainTexture(size),
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

function sandGrainTexture(size) {
  const s = 256;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(s, s);
  for (let i = 0; i < s * s; i++) {
    const v = 225 + Math.random() * 30;
    img.data[i * 4] = v;
    img.data[i * 4 + 1] = v - 2;
    img.data[i * 4 + 2] = v - 6;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(size * 0.7, size * 0.7);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function contactShadow(pos, radius) {
  const s = 128;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = s;
  const ctx = canvas.getContext('2d');
  const g = ctx.createRadialGradient(s / 2, s / 2, 0, s / 2, s / 2, s / 2);
  g.addColorStop(0, 'rgba(60,40,10,0.55)');
  g.addColorStop(0.5, 'rgba(60,40,10,0.25)');
  g.addColorStop(1, 'rgba(60,40,10,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, s, s);
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(radius * 2, radius * 2),
    new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthWrite: false }),
  );
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.set(pos.x, pos.y + 0.012, pos.z);
  return mesh;
}

function createPalm(x, z, height, lean, seed) {
  const group = new THREE.Group();
  const baseY = sandHeight(x, z) - 0.1;
  group.position.set(x, baseY, z);
  group.rotation.y = seed;

  // Curved trunk.
  const pts = [];
  for (let i = 0; i <= 8; i++) {
    const t = i / 8;
    pts.push(new THREE.Vector3(Math.sin(t * 1.3) * lean * height * 0.5 + t * t * lean * 1.5, t * height, 0));
  }
  const curve = new THREE.CatmullRomCurve3(pts);
  const tubular = 40;
  const trunkGeo = new THREE.TubeGeometry(curve, tubular, 0.2, 10, false);
  // Taper + ring bulges.
  const p = trunkGeo.attributes.position;
  const tmp = new THREE.Vector3();
  const colors = new Float32Array(p.count * 3);
  const c1 = new THREE.Color('#8a6a45');
  const c2 = new THREE.Color('#5e4630');
  const c = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const ring = Math.floor(i / 11);
    const t = ring / tubular;
    const center = curve.getPointAt(Math.min(1, t));
    tmp.fromBufferAttribute(p, i).sub(center);
    const bulge = 1 + 0.12 * Math.pow(Math.abs(Math.sin(t * 70)), 3);
    tmp.multiplyScalar((1.35 - 0.6 * t) * bulge);
    p.setXYZ(i, center.x + tmp.x, center.y + tmp.y, center.z + tmp.z);
    c.copy(c1).lerp(c2, Math.pow(Math.abs(Math.sin(t * 70)), 2) * 0.7);
    colors.set([c.r, c.g, c.b], i * 3);
  }
  trunkGeo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  trunkGeo.computeVertexNormals();
  const trunk = new THREE.Mesh(trunkGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95 }));
  trunk.castShadow = true;
  trunk.receiveShadow = true;
  group.add(trunk);

  // Crown of fronds.
  const top = curve.getPointAt(1);
  const crown = new THREE.Group();
  crown.position.copy(top);
  const parts = [];
  const m = new THREE.Matrix4();
  const count = 9;
  for (let i = 0; i < count; i++) {
    const r = Math.abs(Math.sin(seed * 9.1 + i * 3.7));
    const g = leafGeometry({
      length: 3.2 + r * 1.2,
      width: 0.95,
      tilt: 0.9 + r * 0.5,
      bend: 1.3,
      fold: 0.18,
      segments: 22,
      serration: 0.55,
      baseColor: new THREE.Color('#5f9a3a'),
      tipColor: new THREE.Color('#3a6e2a').offsetHSL((r - 0.5) * 0.04, 0, 0),
    });
    m.makeRotationY((i / count) * Math.PI * 2 + r * 0.4);
    g.applyMatrix4(m);
    parts.push(g);
  }
  const fronds = new THREE.Mesh(
    mergeGeometries(parts),
    new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.7, side: THREE.DoubleSide }),
  );
  fronds.castShadow = true;
  crown.add(fronds);

  // Coconuts hanging under the crown.
  const nutMat = new THREE.MeshStandardMaterial({ color: '#5a3d22', roughness: 0.8 });
  for (let i = 0; i < 3; i++) {
    const nut = new THREE.Mesh(new THREE.SphereGeometry(0.17, 12, 10), nutMat);
    const a = (i / 3) * Math.PI * 2 + seed;
    nut.position.set(Math.cos(a) * 0.22, -0.18, Math.sin(a) * 0.22);
    nut.castShadow = true;
    crown.add(nut);
  }

  group.add(crown);
  group.userData.crown = crown;
  group.userData.phase = seed;
  return group;
}

function createRocks() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#8d8a83', roughness: 0.9, flatShading: true });
  const spots = [
    [5.5, 3.5, 0.7],
    [6.4, 4.2, 0.4],
    [-8, 6.5, 0.9],
    [-9.1, 7.2, 0.5],
    [11, 9, 1.4],
    [-4, -9, 0.5],
    [14, -9, 0.8],
  ];
  spots.forEach(([x, z, s], i) => {
    const geo = new THREE.IcosahedronGeometry(1, 1);
    const p = geo.attributes.position;
    for (let k = 0; k < p.count; k++) {
      const vx = p.getX(k);
      const vy = p.getY(k);
      const vz = p.getZ(k);
      const n = 1 + 0.22 * Math.sin(vx * 3.1 + i) * Math.cos(vz * 2.7 - i) + 0.12 * Math.sin(vy * 5 + i * 2);
      p.setXYZ(k, vx * n, vy * n * 0.65, vz * n);
    }
    geo.computeVertexNormals();
    const rock = new THREE.Mesh(geo, mat);
    rock.scale.setScalar(s);
    rock.position.set(x, sandHeight(x, z) + s * 0.15, z);
    rock.rotation.y = i * 1.3;
    rock.castShadow = true;
    rock.receiveShadow = true;
    group.add(rock);
  });
  return group;
}

// A quiet tribute to the original.
function createCoconut(x, z) {
  const geo = new THREE.SphereGeometry(0.2, 20, 16);
  const p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    p.setY(i, p.getY(i) * 1.12);
  }
  geo.computeVertexNormals();
  const nut = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#6b4a2b', roughness: 0.95 }));
  nut.position.set(x, sandHeight(x, z) + 0.14, z);
  nut.rotation.set(0.3, 0.8, 1.2);
  nut.castShadow = true;
  nut.receiveShadow = true;
  return nut;
}

function createStarfish(x, z, rot) {
  const shape = new THREE.Shape();
  const arms = 5;
  for (let i = 0; i <= arms * 2; i++) {
    const a = (i / (arms * 2)) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.16 : 0.065;
    const px = Math.cos(a) * r;
    const py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py);
    else shape.lineTo(px, py);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: 0.025, bevelEnabled: true, bevelThickness: 0.015, bevelSize: 0.015, bevelSegments: 2 });
  const star = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#f07a3a', roughness: 0.75 }));
  star.rotation.set(-Math.PI / 2, 0, rot);
  star.position.set(x, sandHeight(x, z) + 0.01, z);
  star.castShadow = true;
  star.receiveShadow = true;
  return star;
}

function createShells() {
  const group = new THREE.Group();
  const geo = new THREE.SphereGeometry(0.06, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2);
  geo.scale(1, 0.5, 1.2);
  const colors = ['#f7e6d8', '#f2c6b4', '#e8d7b0'];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.39996;
    const r = 2 + (i % 5) * 1.3;
    const x = Math.cos(a) * r;
    const z = Math.sin(a) * r + 1.5;
    const shell = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: colors[i % 3], roughness: 0.5 }));
    shell.position.set(x, sandHeight(x, z), z);
    shell.rotation.y = a * 3;
    shell.castShadow = true;
    group.add(shell);
  }
  return group;
}

function createIslands() {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color: '#4f7f5a', roughness: 1, flatShading: true });
  const sand = new THREE.MeshStandardMaterial({ color: '#e7d3a6', roughness: 1 });
  [
    [-380, 620, 60, 22],
    [-250, 700, 30, 12],
    [420, 800, 90, 35],
  ].forEach(([x, z, r, h], i) => {
    const hill = new THREE.Mesh(new THREE.SphereGeometry(r, 18, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat);
    hill.scale.y = h / r;
    hill.position.set(x, -1, z);
    hill.rotation.y = i;
    group.add(hill);
    const beach = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.08, r * 1.12, 1.2, 24), sand);
    beach.position.set(x, -0.4, z);
    group.add(beach);
  });
  return group;
}
