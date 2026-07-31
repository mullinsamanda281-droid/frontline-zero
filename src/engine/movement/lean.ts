import { type FpsCamera } from '../camera/fpsCamera';

export interface LeanOptions {
  maxOffset?: number;
  heightAdjust?: number;
  easeRate?: number;
  minSprintFactor?: number;
}

interface ResolvedLeanOptions {
  maxOffset: number;
  heightAdjust: number;
  easeRate: number;
  minSprintFactor: number;
}

export class LeanController {
  amount = 0;
  private readonly options: ResolvedLeanOptions;

  constructor(options: LeanOptions = {}) {
    this.options = {
      maxOffset: 0.3,
      heightAdjust: 0.08,
      easeRate: 10,
      minSprintFactor: 1.3,
      ...options,
    };
  }

  update(dt: number, camera: FpsCamera, leanLeft: boolean, leanRight: boolean): void {
    const sprintBlocked = camera.sprintFactor >= this.options.minSprintFactor;
    const target = sprintBlocked ? 0 : (leanLeft ? -1 : 0) + (leanRight ? 1 : 0);
    const blend = Math.min(1, this.options.easeRate * dt);
    this.amount += (target - this.amount) * blend;
    if (Math.abs(this.amount) < 0.005) this.amount = 0;
  }

  get offset(): number {
    return this.amount * this.options.maxOffset;
  }

  get heightOffset(): number {
    return Math.abs(this.amount) * this.options.heightAdjust;
  }

  get isLeaning(): boolean {
    return Math.abs(this.amount) > 0.01;
  }
}
