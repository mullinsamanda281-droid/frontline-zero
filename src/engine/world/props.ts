import * as THREE from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { BoxKind } from './portMap';

export type DecorKind = 'barrel' | 'crate' | 'pallet' | 'sandbag' | 'buoy';

const M = (color: number): THREE.MeshLambertMaterial => new THREE.MeshLambertMaterial({ color });

function mergeIntoGroup(parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }>): THREE.Group {
  const group = new THREE.Group();
  const byMat = new Map<THREE.Material, THREE.BufferGeometry[]>();
  for (const part of parts) {
    const list = byMat.get(part.mat);
    if (list) list.push(part.geo);
    else byMat.set(part.mat, [part.geo]);
  }
  for (const [mat, geos] of byMat) {
    const merged = mergeGeometries(geos);
    if (merged) group.add(new THREE.Mesh(merged, mat));
  }
  return group;
}

const box = (w: number, h: number, d: number, x: number, y: number, z: number): THREE.BoxGeometry => {
  const geo = new THREE.BoxGeometry(w, h, d);
  geo.translate(x, y, z);
  return geo;
};

const cyl = (r: number, h: number, x: number, y: number, z: number, radial = 10): THREE.CylinderGeometry => {
  const geo = new THREE.CylinderGeometry(r, r, h, radial);
  geo.rotateX(Math.PI / 2);
  geo.translate(x, y, z);
  return geo;
};

export function buildContainer(w: number, h: number, d: number, dark = false): THREE.Group {
  const main = dark ? M(0x7c3a1c) : M(0xb4572e);
  const trim = dark ? M(0x5c2a12) : M(0x8f4422);
  const roof = M(0x6e3d22);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  const pad = 0.03;
  parts.push({ geo: box(w, h, d, 0, h / 2, 0), mat: main });
  parts.push({
    geo: box(w + pad * 2, 0.14, d + pad * 2, 0, h + 0.07, 0),
    mat: roof,
  });
  const c = 0.06;
  const ox = w / 2 + pad;
  const oz = d / 2 + pad;
  for (const [sx, sz] of [
    [1, 1],
    [1, -1],
    [-1, 1],
    [-1, -1],
  ] as const) {
    parts.push({ geo: box(c, h + 0.1, c, ox * sx, h / 2, oz * sz), mat: trim });
  }
  parts.push({ geo: box(w + pad * 2, 0.1, c * 2, 0, 0.05, oz), mat: trim });
  parts.push({ geo: box(w + pad * 2, 0.1, c * 2, 0, 0.05, -oz), mat: trim });
  parts.push({ geo: box(0.08, h, d + 0.05, w / 2 + pad, h / 2, 0), mat: trim });
  return mergeIntoGroup(parts);
}

export function buildWarehouse(w: number, h: number, d: number): THREE.Group {
  const wall = M(0x8a8578);
  const roof = M(0x6e4a2c);
  const frame = M(0x6f6a5e);
  const dark = M(0x3a3730);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  const t = 0.25;
  parts.push({ geo: box(w, t, d, 0, 0.05, 0), mat: dark });
  parts.push({ geo: box(w, h, t, 0, h / 2, -d / 2), mat: wall });
  parts.push({ geo: box(w, h, t, 0, h / 2, d / 2), mat: wall });
  parts.push({ geo: box(t, h, d, -w / 2, h / 2, 0), mat: wall });
  parts.push({ geo: box(t, h, d, w / 2, h / 2, 0), mat: wall });
  parts.push({ geo: box(3.6, h - 0.4, t + 0.02, 0, (h - 0.4) / 2, d / 2), mat: dark });
  parts.push({ geo: box(t, h - 0.4, t, -1.9, (h - 0.4) / 2, d / 2), mat: dark });
  parts.push({ geo: box(t, h - 0.4, t, 1.9, (h - 0.4) / 2, d / 2), mat: dark });
  const ridge = Math.hypot(w, 2.4) / 2;
  parts.push({ geo: box(ridge, 0.18, 0.22, -w / 4, h + 1.1, 0), mat: frame });
  parts.push({ geo: box(ridge, 0.18, 0.22, w / 4, h + 1.1, 0), mat: frame });
  const slope = new THREE.BoxGeometry(ridge, 0.14, d + 0.6);
  slope.rotateZ(Math.atan2(2.4, w) * (w > d ? 1 : 1));
  const slopeA = slope.clone();
  const slopeB = slope.clone();
  slopeA.translate(-w / 4, h + 0.4, 0);
  slopeB.translate(w / 4, h + 0.4, 0);
  slopeB.rotateY(Math.PI);
  parts.push({ geo: slopeA, mat: roof });
  parts.push({ geo: slopeB, mat: roof });
  return mergeIntoGroup(parts);
}

export function buildCrane(h: number): THREE.Group {
  const steel = M(0x37404d);
  const boomMat = M(0x2c333d);
  const accent = M(0xb4572e);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  const leg = (x: number, z: number): void => {
    parts.push({ geo: cyl(0.16, h * 0.85, x, h * 0.42, z, 8), mat: steel });
  };
  leg(-0.6, -0.6);
  leg(0.6, -0.6);
  leg(-0.6, 0.6);
  leg(0.6, 0.6);
  parts.push({ geo: box(1.6, 0.9, 1.6, 0, h * 0.85, 0), mat: steel });
  parts.push({ geo: box(0.8, 0.5, 0.8, 0.55, h * 1.05, -0.2), mat: accent });
  parts.push({ geo: box(7.5, 0.3, 0.3, 2.6, h + 0.5, 0), mat: boomMat });
  parts.push({ geo: box(7.5, 0.08, 0.08, 2.6, h + 0.1, 0), mat: steel });
  parts.push({ geo: cyl(0.05, 0.9, 5.2, h - 0.2, 0, 6), mat: steel });
  parts.push({ geo: box(0.24, 0.24, 0.24, 5.2, h - 0.75, 0), mat: accent });
  return mergeIntoGroup(parts);
}

export function buildCrate(w: number, h: number, d: number): THREE.Group {
  const wood = M(0x9a7b4f);
  const plank = M(0x7d6338);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  parts.push({ geo: box(w, h, d, 0, h / 2, 0), mat: wood });
  const l = 0.07;
  parts.push({ geo: box(w - l * 2, l, d, 0, h - l / 2, 0), mat: plank });
  parts.push({ geo: box(w - l * 2, l, d, 0, l / 2, 0), mat: plank });
  parts.push({ geo: box(w, h, l, 0, h / 2, d / 2), mat: plank });
  parts.push({ geo: box(w, h, l, 0, h / 2, -d / 2), mat: plank });
  return mergeIntoGroup(parts);
}

export function buildBarrel(): THREE.Group {
  const body = M(0x8a2f2f);
  const band = M(0x4a4f55);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  parts.push({ geo: cyl(0.28, 0.85, 0, 0.42, 0, 12), mat: body });
  parts.push({ geo: cyl(0.29, 0.1, 0, 0.8, 0, 12), mat: band });
  parts.push({ geo: cyl(0.29, 0.1, 0, 0.05, 0, 12), mat: band });
  parts.push({ geo: cyl(0.2, 0.05, 0, 0.84, 0, 10), mat: band });
  return mergeIntoGroup(parts);
}

export function buildPallet(): THREE.Group {
  const wood = M(0x8a6f45);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  parts.push({ geo: box(1.0, 0.12, 1.2, 0, 0.06, 0), mat: wood });
  for (const z of [-0.45, 0, 0.45]) parts.push({ geo: box(0.16, 0.14, 1.14, 0, 0.19, z), mat: wood });
  for (const x of [-0.4, 0, 0.4]) parts.push({ geo: box(0.9, 0.07, 0.14, x, 0.29, 0), mat: wood });
  return mergeIntoGroup(parts);
}

export function buildSandbags(): THREE.Group {
  const bag = M(0x8a8468);
  const bagDark = M(0x736e56);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  const b = (x: number, z: number, y: number, m: THREE.Material): void => {
    const g = new THREE.BoxGeometry(0.5, 0.24, 0.9);
    g.translate(x, y, z);
    g.scale(1, 0.8, 1);
    parts.push({ geo: g, mat: m });
  };
  for (const z of [-0.45, 0.45]) b(0, z, 0.12, bag);
  for (const z of [-0.45, 0, 0.45]) b(0, z, 0.42, bagDark);
  for (const z of [-0.45, 0.45]) b(0, z, 0.66, bag);
  return mergeIntoGroup(parts);
}

export function buildBuoy(): THREE.Group {
  const red = M(0xcc3a2e);
  const parts: Array<{ geo: THREE.BufferGeometry; mat: THREE.Material }> = [];
  const body = new THREE.SphereGeometry(0.28, 10, 8);
  body.scale(1, 0.72, 1);
  body.translate(0, 0.2, 0);
  parts.push({ geo: body, mat: red });
  parts.push({ geo: cyl(0.05, 1.1, 0, 0.85, 0, 6), mat: M(0x555c63) });
  return mergeIntoGroup(parts);
}

const WAREHOUSE_SLAB = 0.6;

export interface PropOutput {
  group: THREE.Group;
  height: number;
}

export function buildProp(kind: BoxKind | DecorKind, w: number, h: number, d: number): PropOutput {
  switch (kind) {
    case 'container':
      return { group: buildContainer(w, h, d), height: h };
    case 'containerDark':
      return { group: buildContainer(w, h, d, true), height: h };
    case 'warehouse':
      return { group: buildWarehouse(w, h, d), height: h + WAREHOUSE_SLAB };
    case 'crane':
      return { group: buildCrane(h), height: h };
    case 'crate':
      return { group: buildCrate(w, h, d), height: h };
    case 'barrel':
      return { group: buildBarrel(), height: 0.85 };
    case 'pallet':
      return { group: buildPallet(), height: 0.32 };
    case 'sandbag':
      return { group: buildSandbags(), height: 0.78 };
    case 'buoy':
      return { group: buildBuoy(), height: 1.2 };
  }
}

export function isDecorKind(kind: BoxKind | DecorKind): kind is DecorKind {
  return kind === 'barrel' || kind === 'crate' || kind === 'pallet' || kind === 'sandbag' || kind === 'buoy';
}
