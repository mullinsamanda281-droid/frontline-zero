import * as THREE from 'three';

export const HORIZON_COLOR = 0xaec6d9;

const SKY_VERT = /* glsl */ `
varying vec3 vPos;
void main() {
  vPos = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
varying vec3 vPos;
uniform vec3 uTop;
uniform vec3 uHorizon;
uniform vec3 uGround;
void main() {
  vec3 dir = normalize(vPos);
  float h = dir.y;
  vec3 col = h >= 0.0
    ? mix(uHorizon, uTop, pow(h, 0.55))
    : mix(uHorizon, uGround, pow(-h, 0.45));
  col = pow(col, vec3(1.0 / 2.2));
  gl_FragColor = vec4(col, 1.0);
}
`;

export function createSky(): THREE.Mesh {
  const mat = new THREE.ShaderMaterial({
    vertexShader: SKY_VERT,
    fragmentShader: SKY_FRAG,
    uniforms: {
      uTop: { value: new THREE.Color(0x3a6ea8) },
      uHorizon: { value: new THREE.Color(HORIZON_COLOR) },
      uGround: { value: new THREE.Color(0x8a95a3) },
    },
    side: THREE.BackSide,
    depthWrite: false,
  });
  mat.fog = false;
  const sky = new THREE.Mesh(new THREE.SphereGeometry(180, 24, 12), mat);
  sky.name = 'sky';
  return sky;
}

export function createSunDisc(): THREE.Mesh {
  const mat = new THREE.MeshBasicMaterial({ color: 0xfff3d0, fog: false });
  const disc = new THREE.Mesh(new THREE.CircleGeometry(5.5, 24), mat);
  disc.name = 'sun-disc';
  return disc;
}

function buildGroundPixels(size: number, rng: () => number): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(new ArrayBuffer(size * size * 3));
  const cells = 8;
  const cell = size / cells;
  const at = (x: number, y: number): [number, number, number] => {
    const i = (y * size + x) * 3;
    return [data[i], data[i + 1], data[i + 2]];
  };
  const set = (x: number, y: number, r: number, g: number, b: number): void => {
    if (x < 0 || y < 0 || x >= size || y >= size) return;
    const i = (y * size + x) * 3;
    data[i] = r;
    data[i + 1] = g;
    data[i + 2] = b;
  };
  const blend = (x: number, y: number, r: number, g: number, b: number, a: number): void => {
    const [cr, cg, cb] = at(x, y);
    set(x, y, Math.round(cr + (r - cr) * a), Math.round(cg + (g - cg) * a), Math.round(cb + (b - cb) * a));
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const cx = Math.floor(x / cell);
      const cy = Math.floor(y / cell);
      const base = (cx + cy) % 2 === 0 ? [0x8b, 0x8f, 0x88] : [0x84, 0x88, 0x7f];
      set(x, y, base[0], base[1], base[2]);
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const rx = x % cell;
      const ry = y % cell;
      if (rx < 3 || ry < 3) blend(x, y, 0x60, 0x64, 0x5c, 0.9);
      if (rx > 3 && rx < 6 && ry > 0 && ry < cell - 4) blend(x, y, 0x4a, 0x4e, 0x46, 0.6);
    }
  }
  for (let c = 0; c < 42; c++) {
    let px = rng() * size;
    let py = rng() * size;
    for (let s = 0; s < 5; s++) {
      const nx = px + (rng() - 0.5) * 56;
      const ny = py + (rng() - 0.5) * 56;
      const steps = Math.max(1, Math.ceil(Math.hypot(nx - px, ny - py)));
      for (let t = 0; t <= steps; t++) {
        blend(Math.round(px + ((nx - px) * t) / steps), Math.round(py + ((ny - py) * t) / steps), 0x3c, 0x3e, 0x3a, 0.5);
      }
      px = nx;
      py = ny;
    }
  }
  for (let d = 0; d < 14; d++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 18 + rng() * 42;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const dist = Math.hypot(dx, dy);
        if (dist > r) continue;
        blend(Math.round(x + dx), Math.round(y + dy), 0x7d, 0x7a, 0x6a, (1 - dist / r) * 0.35);
      }
    }
  }
  for (let s = 0; s < 20; s++) {
    const x = rng() * size;
    const y = rng() * size;
    const r = 3 + rng() * 10;
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.hypot(dx, dy) > r) continue;
        blend(Math.round(x + dx), Math.round(y + dy), 0x1e, 0x20, 0x1e, 0.28);
      }
    }
  }
  for (let y = 0; y < size; y++) {
    for (let x = size / 2 - 10; x < size / 2 + 10; x++) blend(x, y, 0xd6, 0xbe, 0x78, 0.8);
  }
  return data;
}

function makeRepeatableTexture(rgb: Uint8Array<ArrayBuffer>, width: number, height: number): THREE.DataTexture {
  const rgba = new Uint8Array(new ArrayBuffer(rgb.length + width * height * 1));
  for (let i = 0; i < width * height; i++) {
    rgba[i * 4] = rgb[i * 3];
    rgba[i * 4 + 1] = rgb[i * 3 + 1];
    rgba[i * 4 + 2] = rgb[i * 3 + 2];
    rgba[i * 4 + 3] = 255;
  }
  const texture = new THREE.DataTexture(rgba, width, height, THREE.RGBAFormat);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  return texture;
}

export interface GroundResult {
  mesh: THREE.Mesh;
  texture: THREE.DataTexture;
}

export function createGround(size = 150, tileMeters = 15, rng: () => number = Math.random): GroundResult {
  const texSize = 512;
  const texture = makeRepeatableTexture(buildGroundPixels(texSize, rng), texSize, texSize);
  const repeat = size / tileMeters;
  texture.repeat.set(repeat, repeat);

  const material = new THREE.MeshLambertMaterial({ map: texture });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.receiveShadow = true;
  mesh.name = 'ground';
  return { mesh, texture };
}

function buildWaterPixels(size: number): Uint8Array<ArrayBuffer> {
  const data = new Uint8Array(new ArrayBuffer(size * size * 3));
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const wave =
        Math.sin((x / size) * Math.PI * 12 + (y / size) * Math.PI * 7) * 0.5 +
        Math.sin((y / size) * Math.PI * 23) * 0.3 +
        Math.sin(((x + y) / size) * Math.PI * 31) * 0.2;
      const light = wave > 0.45 ? 0.75 : wave > 0.15 ? 0.5 : 0.25;
      const i = (y * size + x) * 3;
      data[i] = Math.round(0x2c + (0x8c - 0x2c) * light * 0.55);
      data[i + 1] = Math.round(0x66 + (0xbe - 0x66) * light * 0.55);
      data[i + 2] = Math.round(0x89 + (0xde - 0x89) * light * 0.55);
    }
  }
  return data;
}

export interface WaterResult {
  mesh: THREE.Mesh;
  tick(dt: number): void;
}

export function createWater(size = 400): WaterResult {
  const texSize = 128;
  const texture = makeRepeatableTexture(buildWaterPixels(texSize), texSize, texSize);
  texture.repeat.set(40, 40);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshLambertMaterial({
    map: texture,
    transparent: true,
    opacity: 0.92,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size, size), material);
  mesh.rotation.x = -Math.PI / 2;
  mesh.position.y = -0.06;
  mesh.name = 'water';
  return {
    mesh,
    tick: (dt: number) => {
      texture.offset.x += dt * 0.012;
      texture.offset.y += dt * 0.008;
    },
  };
}

export function createSun(): THREE.DirectionalLight {
  const sun = new THREE.DirectionalLight(0xffe8c8, 1.6);
  sun.position.set(42, 60, 28);
  sun.castShadow = true;
  sun.shadow.mapSize.width = 1024;
  sun.shadow.mapSize.height = 1024;
  sun.shadow.camera.near = 5;
  sun.shadow.camera.far = 180;
  sun.shadow.camera.left = -90;
  sun.shadow.camera.right = 90;
  sun.shadow.camera.top = 90;
  sun.shadow.camera.bottom = -90;
  sun.shadow.bias = -0.0005;
  sun.shadow.normalBias = 0.3;
  return sun;
}
