import { Vec3 } from '../camera/vec3';
import { RecoilState } from './recoil';
import { type RaycastQuery, fireHitscan } from './hitscan';
import { type WeaponData } from './weaponData';

export interface ShotOutcome {
  hitCount: number;
  totalDamage: number;
  bloom: number;
  lastHitX: number;
  lastHitY: number;
  lastHitZ: number;
}

export interface WeaponUpdateInput {
  moving: boolean;
  triggerHeld: boolean;
}

export class WeaponRuntime {
  readonly recoil = new RecoilState();
  ammo: number;
  reserve: number;
  bloom = 0;
  reloading = false;
  drawing = false;
  private fireTimer = 0;
  private reloadTimer = 0;
  private drawTimer = 0;

  constructor(readonly data: WeaponData) {
    this.ammo = data.magSize;
    this.reserve = data.reserveMax - data.magSize;
  }

  get canFire(): boolean {
    return this.fireTimer <= 0 && this.ammo > 0 && !this.reloading && !this.drawing;
  }

  get reloadProgress(): number {
    return this.data.reloadTime === 0 ? 1 : 1 - this.reloadTimer / this.data.reloadTime;
  }

  get drawProgress(): number {
    const t = this.data.switchTime ?? 0.5;
    return t === 0 ? 1 : 1 - this.drawTimer / t;
  }

  draw(): void {
    this.cancelReload();
    this.drawing = true;
    this.drawTimer = this.data.switchTime ?? 0.5;
  }

  update(dt: number, input: WeaponUpdateInput): void {
    this.fireTimer = Math.max(0, this.fireTimer - dt);

    if (this.drawing) {
      this.drawTimer -= dt;
      if (this.drawTimer <= 0) this.drawing = false;
    }

    if (this.reloading) {
      this.reloadTimer -= dt;
      if (this.reloadTimer <= 0) {
        const toLoad = Math.min(this.data.magSize - this.ammo, this.reserve);
        this.ammo += toLoad;
        this.reserve -= toLoad;
        this.reloading = false;
      }
    }

    const firing = input.triggerHeld && this.canFire;
    const shooting = input.triggerHeld && this.fireTimer <= 0 && this.ammo > 0 && !this.reloading;
    if (firing || input.moving) {
      const rate =
        (shooting ? this.data.bloomPerShot : 0) + (input.moving ? this.data.bloomMovePerSec : 0);
      this.bloom = Math.min(1, this.bloom + rate * dt);
    } else {
      this.bloom = Math.max(0, this.bloom - this.data.bloomRecoveryPerSec * dt);
    }

    this.recoil.recover(dt, this.data.recoilRecovery);
  }

  fire(origin: Vec3, direction: Vec3, raycast: RaycastQuery, rng: () => number): ShotOutcome {
    if (!this.canFire) return { hitCount: 0, totalDamage: 0, bloom: this.bloom, lastHitX: 0, lastHitY: 0, lastHitZ: 0 };

    this.fireTimer = 1 / this.data.fireRate;
    this.ammo--;

    const pattern = this.data.recoilPattern;
    this.recoil.apply(pattern[this.recoil.shotCount % pattern.length]);
    this.bloom = Math.min(1, this.bloom + this.data.bloomPerShot);

    const hits = fireHitscan({
      data: this.data,
      origin,
      direction,
      raycast,
      rng,
    });
    let hitCount = 0;
    let totalDamage = 0;
    let lastHitX = 0;
    let lastHitY = 0;
    let lastHitZ = 0;
    for (const hit of hits) {
      if (hit.target !== null) {
        hitCount++;
        totalDamage += hit.damage;
        lastHitX = hit.hitX;
        lastHitY = hit.hitY;
        lastHitZ = hit.hitZ;
      }
    }
    return { hitCount, totalDamage, bloom: this.bloom, lastHitX, lastHitY, lastHitZ };
  }

  reload(): void {
    if (this.reloading || this.ammo >= this.data.magSize || this.reserve <= 0) return;
    this.reloading = true;
    this.reloadTimer = this.data.reloadTime;
  }

  cancelReload(): void {
    this.reloading = false;
  }
}
