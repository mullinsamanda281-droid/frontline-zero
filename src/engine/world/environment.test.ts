import { describe, expect, it } from 'vitest';
import * as THREE from 'three';
import { createGround, createSky, createSun, createSunDisc, createWater, HORIZON_COLOR } from './environment';

describe('environment', () => {
  it('createSky returns a backside sphere shader mesh', () => {
    const sky = createSky();
    expect(sky).toBeInstanceOf(THREE.Mesh);
    expect(sky.material).toBeInstanceOf(THREE.ShaderMaterial);
    expect((sky.material as THREE.ShaderMaterial).side).toBe(THREE.BackSide);
  });

  it('createSunDisc is a basic material mesh far away', () => {
    const disc = createSunDisc();
    expect(disc.material).toBeInstanceOf(THREE.MeshBasicMaterial);
    expect((disc.material as THREE.MeshBasicMaterial).fog).toBe(false);
  });

  it('createGround builds a textured plane', () => {
    const { mesh, texture } = createGround(150, 15, () => 0.5);
    expect(mesh).toBeInstanceOf(THREE.Mesh);
    expect(mesh.receiveShadow).toBe(true);
    expect(texture.wrapS).toBe(THREE.RepeatWrapping);
    expect(texture.repeat.x).toBeCloseTo(10);
    expect(mesh.material).toBeInstanceOf(THREE.MeshLambertMaterial);
  });

  it('createWater ticks move the texture offset', () => {
    const { mesh, tick } = createWater(400);
    const mat = mesh.material as THREE.MeshLambertMaterial;
    const map = mat.map as THREE.DataTexture;
    const ox = map.offset.x;
    const oy = map.offset.y;
    tick(1);
    expect(map.offset.x).not.toBe(ox);
    expect(map.offset.y).not.toBe(oy);
  });

  it('createSun casts shadows over the play area', () => {
    const sun = createSun();
    expect(sun.castShadow).toBe(true);
    expect(sun.shadow.camera.right).toBeGreaterThanOrEqual(80);
    expect(sun.shadow.bias).toBeLessThan(0);
  });

  it('horizon color matches fog expectation', () => {
    expect(HORIZON_COLOR).toBe(0xaec6d9);
  });
});
