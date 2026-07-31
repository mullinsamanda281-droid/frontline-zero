import { type FpsCamera } from '../camera/fpsCamera';

export interface BunnyHopOptions {
  bonusPerHop?: number;
  maxBonus?: number;
  minSprintFactor?: number;
  airtimeRequiredMs?: number;
}

interface ResolvedBunnyHopOptions {
  bonusPerHop: number;
  maxBonus: number;
  minSprintFactor: number;
  airtimeRequiredMs: number;
}

export class BunnyHopController {
  private airborne = false;
  private airtimeMs = 0;
  private speedBonus = 0;
  private readonly options: ResolvedBunnyHopOptions;

  constructor(options: BunnyHopOptions = {}) {
    this.options = {
      bonusPerHop: 0.6,
      maxBonus: 1.8,
      minSprintFactor: 1.3,
      airtimeRequiredMs: 80,
      ...options,
    };
  }

  update(dtMs: number, camera: FpsCamera, jumpHeld: boolean): void {
    if (!camera.onGround) {
      this.airborne = true;
      this.airtimeMs += dtMs;
      return;
    }

    if (camera.justLanded && this.airborne && this.airtimeMs >= this.options.airtimeRequiredMs) {
      if (jumpHeld && camera.sprintFactor >= this.options.minSprintFactor) {
        const horizontalSpeed = Math.hypot(camera.velocity.x, camera.velocity.z);
        if (horizontalSpeed > 0.1 && this.speedBonus < this.options.maxBonus) {
          this.speedBonus = Math.min(
            this.options.maxBonus,
            this.speedBonus + this.options.bonusPerHop,
          );
          const scale = (horizontalSpeed + this.options.bonusPerHop) / horizontalSpeed;
          camera.velocity.x *= scale;
          camera.velocity.z *= scale;
        }
      }
    }

    this.airborne = false;
    this.airtimeMs = 0;
  }

  get bonus(): number {
    return this.speedBonus;
  }
}
