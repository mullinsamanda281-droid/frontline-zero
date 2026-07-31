import { describe, expect, it } from 'vitest';
import { Vec3 } from '../camera/vec3';
import { WeaponRuntime } from './weapon';
import { WEAPONS } from './weapons';
import { resolveFalloffDamage, type WeaponData } from './weaponData';

class Dummy {
  hp = 100;
  takeDamage(amount: number): void {
    this.hp -= amount;
  }
}

const ORIGIN = new Vec3(0, 1.6, 0);
const FORWARD = new Vec3(0, 0, -1);
const rng = (): number => 0.5;

function ttkToKill(data: WeaponData, distance: number): number {
  const shots = Math.ceil(100 / resolveFalloffDamage(data, distance));
  return (shots - 1) / data.fireRate;
}

describe('Damage profiles', () => {
  it('AR: reliable mid-range full-auto', () => {
    const ar = WEAPONS.ar;
    expect(ar.damage).toBeGreaterThanOrEqual(20);
    expect(ar.damage).toBeLessThanOrEqual(30);
    expect(ttkToKill(ar, 10)).toBeLessThan(0.5);
    expect(ttkToKill(ar, 60)).toBeLessThan(0.6);
  });

  it('AR: 5 shots to kill at close range', () => {
    const ar = WEAPONS.ar;
    const dmg = resolveFalloffDamage(ar, 5);
    expect(Math.ceil(100 / dmg)).toBe(5);
  });

  it('SMG: highest fire rate, steep falloff, no movement penalty', () => {
    const smg = WEAPONS.smg;
    expect(smg.fireRate).toBeGreaterThan(WEAPONS.ar.fireRate);
    expect(smg.moveSpeedMultiplier).toBe(1);
    const close = ttkToKill(smg, 5);
    const far = ttkToKill(smg, 60);
    expect(close).toBeLessThan(0.45);
    expect(far).toBeGreaterThan(close + 0.35);
  });

  it('SMG: 6+ shots to kill at close range', () => {
    const smg = WEAPONS.smg;
    expect(Math.ceil(100 / resolveFalloffDamage(smg, 5))).toBeGreaterThanOrEqual(6);
  });

  it('Marksman: semi-auto, high accuracy, headshot multiplier 2x', () => {
    const mm = WEAPONS.marksman;
    expect(mm.semiAuto).toBe(true);
    expect(mm.headshotMultiplier).toBe(2);
    expect(mm.spreadMax).toBeLessThan(WEAPONS.ar.spreadMax);
    const bodyDmg = resolveFalloffDamage(mm, 30);
    expect(Math.ceil(100 / bodyDmg)).toBeLessThanOrEqual(2);
    expect(bodyDmg * (mm.headshotMultiplier ?? 1)).toBeGreaterThanOrEqual(100);
  });

  it('Marksman: headshot one-taps at range', () => {
    const mm = WEAPONS.marksman;
    const headshot = resolveFalloffDamage(mm, 50) * (mm.headshotMultiplier ?? 1);
    expect(headshot).toBeGreaterThanOrEqual(100);
  });

  it('Sniper: one-shot body kill, slow handling', () => {
    const sniper = WEAPONS.sniper;
    expect(sniper.damage).toBeGreaterThanOrEqual(100);
    expect(sniper.semiAuto).toBe(true);
    expect(sniper.switchTime).toBeGreaterThan(WEAPONS.sidearm.switchTime ?? 1);
    expect(sniper.moveSpeedMultiplier).toBeLessThan(0.85);
    expect(sniper.scopeZoom).toBeGreaterThanOrEqual(4);
  });

  it('Sniper: headshot multiplier 2.5x', () => {
    const sniper = WEAPONS.sniper;
    expect(sniper.headshotMultiplier).toBe(2.5);
  });

  it('Shotgun: 8 pellets, devastating up close, steep falloff', () => {
    const sg = WEAPONS.shotgun;
    expect(sg.pelletCount).toBe(8);
    const close = resolveFalloffDamage(sg, 3) * sg.pelletCount;
    const far = resolveFalloffDamage(sg, 30) * sg.pelletCount;
    expect(close).toBeGreaterThanOrEqual(100);
    expect(far).toBeLessThan(close * 0.6);
  });

  it('Shotgun: fires all pellets with spread applied', () => {
    const weapon = new WeaponRuntime(WEAPONS.shotgun);
    const hits: Vec3[] = [];
    const outcome = weapon.fire(
      ORIGIN,
      FORWARD,
      (_o, d) => {
        hits.push(d.clone());
        return { target: new Dummy(), distance: 10 };
      },
      () => Math.random(),
    );
    expect(outcome.hitCount).toBe(8);
    const angles = hits.map((d) => Math.acos(Math.max(-1, Math.min(1, -d.z))));
    const distinct = new Set(angles.map((a) => a.toFixed(4))).size;
    expect(distinct).toBeGreaterThan(4);
  });

  it('Sidearm: fastest switch time, balanced low damage', () => {
    const sa = WEAPONS.sidearm;
    const fastest = Math.min(
      ...Object.values(WEAPONS).map((w) => w.switchTime ?? 0.5),
    );
    expect(sa.switchTime).toBe(fastest);
    expect(sa.damage).toBeLessThan(WEAPONS.ar.damage);
    expect(sa.semiAuto).toBe(true);
  });

  it('Sidearm: 5 shots to kill at close range', () => {
    const sa = WEAPONS.sidearm;
    expect(Math.ceil(100 / resolveFalloffDamage(sa, 10))).toBe(5);
  });
});

describe('Weapon switching', () => {
  it('blocks firing while drawing', () => {
    const weapon = new WeaponRuntime(WEAPONS.sniper);
    weapon.draw();
    expect(weapon.drawing).toBe(true);
    expect(weapon.canFire).toBe(false);
    for (let i = 0; i < 60; i++) weapon.update(1 / 60, { moving: false, triggerHeld: false });
    expect(weapon.drawing).toBe(false);
    expect(weapon.canFire).toBe(true);
  });

  it('draw cancels reload', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    for (let i = 0; i < 30; i++) {
      weapon.update(1, { moving: false, triggerHeld: false });
      weapon.fire(ORIGIN, FORWARD, () => ({ target: new Dummy(), distance: 10 }), rng);
    }
    weapon.reload();
    expect(weapon.reloading).toBe(true);
    weapon.draw();
    expect(weapon.reloading).toBe(false);
    expect(weapon.drawing).toBe(true);
  });
});
