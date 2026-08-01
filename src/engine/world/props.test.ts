import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import {
  buildBarrel,
  buildBuoy,
  buildContainer,
  buildCrane,
  buildCrate,
  buildPallet,
  buildProp,
  buildSandbags,
  buildWarehouse,
} from './props';

function meshCount(group: THREE.Object3D): number {
  let count = 0;
  group.traverse((o) => {
    if (o instanceof THREE.Mesh) count++;
  });
  return count;
}

describe('props', () => {
  it('builds a container with merged meshes within budget', () => {
    const group = buildContainer(6, 2.5, 3);
    expect(meshCount(group)).toBeLessThanOrEqual(6);
    expect(group.children.length).toBeGreaterThan(0);
  });

  it('builds dark container variant', () => {
    const dark = buildContainer(6, 2.5, 3, true);
    const light = buildContainer(6, 2.5, 3, false);
    expect(dark.children.length).toBe(light.children.length);
  });

  it('builds a warehouse with roof slopes and door', () => {
    const group = buildWarehouse(14, 6, 10);
    expect(meshCount(group)).toBeLessThanOrEqual(8);
  });

  it('builds a crane with legs, cab and boom', () => {
    const group = buildCrane(14);
    expect(meshCount(group)).toBeLessThanOrEqual(8);
  });

  it('builds crate, barrel, pallet, sandbag and buoy', () => {
    expect(meshCount(buildCrate(3, 2.5, 6))).toBeGreaterThan(0);
    expect(meshCount(buildBarrel())).toBeGreaterThan(0);
    expect(meshCount(buildPallet())).toBeGreaterThan(0);
    expect(meshCount(buildSandbags())).toBeGreaterThan(0);
    expect(meshCount(buildBuoy())).toBeGreaterThan(0);
  });

  it('buildProp dispatches by kind and reports height', () => {
    expect(buildProp('container', 6, 2.5, 3).height).toBeCloseTo(2.5);
    expect(buildProp('warehouse', 14, 6, 10).height).toBeGreaterThan(6);
    expect(buildProp('crane', 2, 14, 2).height).toBeCloseTo(14);
    expect(buildProp('barrel', 1, 1, 1).height).toBeCloseTo(0.85);
    expect(buildProp('pallet', 1, 1, 1).height).toBeCloseTo(0.32);
    expect(buildProp('crate', 3, 2, 3).height).toBeCloseTo(2);
  });

  it('all prop groups are centered at origin so callers place them', () => {
    const group = buildContainer(6, 2.5, 3);
    expect(group.position.x).toBe(0);
    expect(group.position.y).toBe(0);
    expect(group.position.z).toBe(0);
  });
});
