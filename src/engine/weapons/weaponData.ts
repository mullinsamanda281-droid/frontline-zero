export type WeaponClass = 'ar' | 'smg' | 'marksman' | 'sniper' | 'shotgun' | 'sidearm';

export interface RecoilStep {
  vertical: number;
  horizontal: number;
}

export interface WeaponData {
  id: string;
  name: string;
  class: WeaponClass;
  damage: number;
  fireRate: number;
  magSize: number;
  reserveMax: number;
  reloadTime: number;
  pelletCount: number;
  spreadMin: number;
  spreadMax: number;
  bloomPerShot: number;
  bloomRecoveryPerSec: number;
  bloomMovePerSec: number;
  recoilPattern: RecoilStep[];
  recoilRecovery: number;
  range: number;
  falloffStart: number;
  falloffEnd: number;
  semiAuto?: boolean;
  headshotMultiplier?: number;
  switchTime?: number;
  moveSpeedMultiplier?: number;
  scopeZoom?: number;
}

export function resolveFalloffDamage(data: WeaponData, distance: number): number {
  if (distance <= data.falloffStart) return data.damage;
  if (distance >= data.falloffEnd) return data.damage * 0.5;
  const t = (distance - data.falloffStart) / (data.falloffEnd - data.falloffStart);
  return data.damage * (1 - t * 0.5);
}
