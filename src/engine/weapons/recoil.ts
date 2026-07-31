import { type WeaponData } from './weaponData';

export class RecoilState {
  pitchOffset = 0;
  yawOffset = 0;
  shotCount = 0;

  apply(pattern: WeaponData['recoilPattern'][number]): void {
    this.pitchOffset += pattern.vertical;
    this.yawOffset += pattern.horizontal;
    this.shotCount++;
  }

  recover(dt: number, ratePerSec: number, recoveryDelay = 0): void {
    if (this.shotCount === 0) return;
    const elapsed = dt - recoveryDelay;
    if (elapsed <= 0) return;
    const step = ratePerSec * elapsed;
    const pitchSign = Math.sign(this.pitchOffset);
    const yawSign = Math.sign(this.yawOffset);
    this.pitchOffset = Math.abs(this.pitchOffset) <= step ? 0 : this.pitchOffset - pitchSign * step;
    this.yawOffset = Math.abs(this.yawOffset) <= step ? 0 : this.yawOffset - yawSign * step;
  }

  reset(): void {
    this.pitchOffset = 0;
    this.yawOffset = 0;
    this.shotCount = 0;
  }
}
