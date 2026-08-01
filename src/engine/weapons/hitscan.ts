import { Vec3 } from '../camera/vec3';
import { type WeaponData, resolveFalloffDamage } from './weaponData';

export interface Damageable {
  takeDamage(amount: number): void;
}

export interface RayHit {
  distance: number;
  damage: number;
  target: Damageable | null;
  hitX: number;
  hitY: number;
  hitZ: number;
}

export interface RaycastResult {
  target: Damageable | null;
  distance: number;
  isHeadshot?: boolean;
}

export interface RaycastQuery {
  (origin: Vec3, direction: Vec3, range: number): RaycastResult;
}

const UP = new Vec3(0, 1, 0);

export function spreadDirection(direction: Vec3, coneRadians: number, rng: () => number): Vec3 {
  if (coneRadians <= 0) return direction.clone();
  const cosLimit = Math.cos(coneRadians);
  const z = 1 - rng() * (1 - cosLimit);
  const r = Math.sqrt(Math.max(0, 1 - z * z));
  const phi = rng() * Math.PI * 2;

  const axis = Math.abs(direction.y) > 0.9 ? new Vec3(1, 0, 0) : UP;
  const right = axis.cross(direction).normalized();
  const up = direction.cross(right).normalized();

  const dx = right.x * Math.cos(phi) + up.x * Math.sin(phi);
  const dy = right.y * Math.cos(phi) + up.y * Math.sin(phi);
  const dz = right.z * Math.cos(phi) + up.z * Math.sin(phi);

  return new Vec3(
    direction.x * z + dx * r,
    direction.y * z + dy * r,
    direction.z * z + dz * r,
  ).normalized();
}

export interface FireInput {
  data: WeaponData;
  origin: Vec3;
  direction: Vec3;
  raycast: RaycastQuery;
  rng: () => number;
}

export function fireHitscan({ data, origin, direction, raycast, rng }: FireInput): RayHit[] {
  const hits: RayHit[] = [];
  for (let i = 0; i < data.pelletCount; i++) {
    const dir = spreadDirection(direction, data.spreadMax, rng);
    const result = raycast(origin, dir, data.range);
    let damage = result.target === null ? 0 : resolveFalloffDamage(data, result.distance);
    if (result.isHeadshot && data.headshotMultiplier) damage *= data.headshotMultiplier;
    hits.push({
      distance: result.distance,
      damage,
      target: result.target,
      hitX: origin.x + dir.x * result.distance,
      hitY: origin.y + dir.y * result.distance,
      hitZ: origin.z + dir.z * result.distance,
    });
    result.target?.takeDamage(damage);
  }
  return hits;
}
