import { describe, expect, it } from 'vitest';
import { Vec3 } from '../camera/vec3';
import { RecoilState } from './recoil';
import { spreadDirection } from './hitscan';
import { WeaponRuntime } from './weapon';
import { WEAPONS } from './weapons';
import { resolveFalloffDamage, type WeaponData } from './weaponData';

function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

class DummyTarget {
  hp: number;
  constructor(hp: number) {
    this.hp = hp;
  }
  takeDamage(amount: number): void {
    this.hp -= amount;
  }
}

const FORWARD = new Vec3(0, 0, -1);
const ORIGIN = new Vec3(0, 1.6, 0);
const rng = (): number => 0.5;

function hitTargetAt(distance: number): (o: Vec3, d: Vec3, range: number) => { target: DummyTarget | null; distance: number } {
  return () => ({ target: new DummyTarget(100), distance });
}

describe('RecoilState', () => {
  it('applies pattern offsets per shot', () => {
    const recoil = new RecoilState();
    recoil.apply({ vertical: 0.01, horizontal: 0.002 });
    expect(recoil.pitchOffset).toBeCloseTo(0.01);
    expect(recoil.yawOffset).toBeCloseTo(0.002);
    expect(recoil.shotCount).toBe(1);
  });

  it('recovers toward zero over time', () => {
    const recoil = new RecoilState();
    recoil.apply({ vertical: 0.06, horizontal: 0.04 });
    recoil.recover(1, 0.05);
    expect(recoil.pitchOffset).toBeCloseTo(0.01);
    expect(recoil.yawOffset).toBeCloseTo(0);
  });

  it('recovers fully after enough time', () => {
    const recoil = new RecoilState();
    recoil.apply({ vertical: 0.06, horizontal: 0.04 });
    for (let i = 0; i < 120; i++) recoil.recover(1 / 60, 0.05);
    expect(recoil.pitchOffset).toBe(0);
    expect(recoil.yawOffset).toBe(0);
  });

  it('wraps the pattern on long bursts', () => {
    const recoil = new RecoilState();
    const pattern = WEAPONS.ar.recoilPattern;
    for (let i = 0; i < pattern.length * 2 + 1; i++) recoil.apply(pattern[i % pattern.length]);
    expect(recoil.shotCount).toBe(pattern.length * 2 + 1);
  });
});

describe('spreadDirection', () => {
  it('returns the direction unchanged for zero cone', () => {
    const dir = spreadDirection(FORWARD, 0, rng);
    expect(dir.x).toBeCloseTo(0);
    expect(dir.z).toBeCloseTo(-1);
  });

  it('stays inside the cone angle', () => {
    for (let i = 0; i < 200; i++) {
      const local = mulberry32(i);
      const dir = spreadDirection(FORWARD, 0.1, local);
      const angle = Math.acos(Math.max(-1, Math.min(1, -dir.z)));
      expect(angle).toBeLessThanOrEqual(0.1 + 1e-9);
    }
  });

  it('normalizes the result', () => {
    const local = mulberry32(7);
    const dir = spreadDirection(new Vec3(0.3, -0.6, 0.74), 0.05, local);
    expect(Math.abs(Math.hypot(dir.x, dir.y, dir.z) - 1)).toBeLessThan(1e-9);
  });
});

describe('WeaponRuntime', () => {
  it('enforces fire rate', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    const second = weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    expect(second.hitCount).toBe(0);
    weapon.update(1 / WEAPONS.ar.fireRate, { moving: false, triggerHeld: false });
    const third = weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    expect(third.hitCount).toBe(1);
  });

  it('damages targets with falloff', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    const target = new DummyTarget(100);
    const outcome = weapon.fire(
      ORIGIN,
      FORWARD,
      () => ({ target, distance: 60 }),
      rng,
    );
    expect(outcome.hitCount).toBe(1);
    expect(outcome.totalDamage).toBeCloseTo(resolveFalloffDamage(WEAPONS.ar, 60), 5);
    expect(target.hp).toBeCloseTo(100 - resolveFalloffDamage(WEAPONS.ar, 60), 5);
  });

  it('shotgun fires multiple pellets', () => {
    const weapon = new WeaponRuntime(WEAPONS.shotgun);
    const outcome = weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    expect(outcome.hitCount).toBe(WEAPONS.shotgun.pelletCount);
    const pelletDamage = resolveFalloffDamage(WEAPONS.shotgun, 10);
    expect(outcome.totalDamage).toBeCloseTo(WEAPONS.shotgun.pelletCount * pelletDamage, 5);
  });

  it('cannot fire with empty magazine', () => {
    const weapon = new WeaponRuntime(WEAPONS.sidearm);
    for (let i = 0; i < WEAPONS.sidearm.magSize; i++) {
      weapon.update(1, { moving: false, triggerHeld: false });
      weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    }
    const empty = weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    expect(empty.hitCount).toBe(0);
    expect(weapon.ammo).toBe(0);
  });

  it('reloads from reserve and is interruptible', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    for (let i = 0; i < 30; i++) {
      weapon.update(1, { moving: false, triggerHeld: false });
      weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    }
    weapon.reload();
    expect(weapon.reloading).toBe(true);
    weapon.update(0.5, { moving: false, triggerHeld: false });
    expect(weapon.reloadProgress).toBeCloseTo(0.5 / 1.8, 1);
    weapon.cancelReload();
    expect(weapon.reloading).toBe(false);
    expect(weapon.ammo).toBe(0);
  });

  it('completes reload and refills the magazine', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    for (let i = 0; i < 30; i++) {
      weapon.update(1, { moving: false, triggerHeld: false });
      weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    }
    weapon.reload();
    for (let i = 0; i < 180; i++) weapon.update(1 / 60, { moving: false, triggerHeld: false });
    expect(weapon.reloading).toBe(false);
    expect(weapon.ammo).toBe(WEAPONS.ar.magSize);
    expect(weapon.reserve).toBe(WEAPONS.ar.reserveMax - 2 * WEAPONS.ar.magSize);
  });

  it('bloom grows while moving and firing, recovers when still', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    for (let i = 0; i < 30; i++) weapon.update(1 / 60, { moving: true, triggerHeld: false });
    const movingBloom = weapon.bloom;
    expect(movingBloom).toBeGreaterThan(0);
    for (let i = 0; i < 120; i++) weapon.update(1 / 60, { moving: false, triggerHeld: false });
    expect(weapon.bloom).toBe(0);
  });

  it('recoil recovers after firing', () => {
    const weapon = new WeaponRuntime(WEAPONS.ar);
    weapon.fire(ORIGIN, FORWARD, hitTargetAt(10), rng);
    const offsetAfterShot = weapon.recoil.pitchOffset;
    expect(offsetAfterShot).toBeGreaterThan(0);
    for (let i = 0; i < 300; i++) weapon.update(1 / 60, { moving: false, triggerHeld: false });
    expect(weapon.recoil.pitchOffset).toBe(0);
  });
});

describe('WeaponData classes', () => {
  it('defines all six classes via the schema', () => {
    expect(Object.keys(WEAPONS)).toEqual(['ar', 'smg', 'marksman', 'sniper', 'shotgun', 'sidearm']);
    for (const data of Object.values(WEAPONS) as WeaponData[]) {
      expect(data.damage).toBeGreaterThan(0);
      expect(data.fireRate).toBeGreaterThan(0);
      expect(data.magSize).toBeGreaterThan(0);
      expect(data.recoilPattern.length).toBeGreaterThan(0);
      expect(data.falloffEnd).toBeGreaterThan(data.falloffStart);
    }
  });
});
