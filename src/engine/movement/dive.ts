import { type FpsCamera } from '../camera/fpsCamera';

export type DivePhase = 'ready' | 'diving' | 'prone' | 'recovering';

export interface DiveOptions {
  diveSpeed?: number;
  diveArcSpeed?: number;
  proneEyeHeight?: number;
  proneMoveMultiplier?: number;
  recoveryTime?: number;
  minSprintFactor?: number;
  standEyeHeight?: number;
  onPhaseChange?: (phase: DivePhase) => void;
}

interface ResolvedDiveOptions {
  diveSpeed: number;
  diveArcSpeed: number;
  proneEyeHeight: number;
  proneMoveMultiplier: number;
  recoveryTime: number;
  minSprintFactor: number;
  standEyeHeight: number;
  onPhaseChange?: (phase: DivePhase) => void;
}

export class DiveController {
  phase: DivePhase = 'ready';
  private readonly options: ResolvedDiveOptions;
  private recoveryTimer = 0;

  constructor(options: DiveOptions = {}) {
    this.options = {
      diveSpeed: 9,
      diveArcSpeed: 3.5,
      proneEyeHeight: 0.4,
      proneMoveMultiplier: 0.5,
      recoveryTime: 0.7,
      minSprintFactor: 1.3,
      standEyeHeight: 1.6,
      ...options,
    };
  }

  update(dt: number, camera: FpsCamera, diveHeld: boolean, proneHeld: boolean): void {
    const sprinting = camera.sprintFactor >= this.options.minSprintFactor;

    switch (this.phase) {
      case 'ready':
        camera.eyeHeight = this.options.standEyeHeight;
        if (diveHeld && sprinting && camera.onGround) {
          this.setPhase('diving');
          camera.speedMultiplier = 1;
          const forward = camera.forward;
          camera.velocity.x = forward.x * this.options.diveSpeed;
          camera.velocity.z = forward.z * this.options.diveSpeed;
          camera.velocity.y = this.options.diveArcSpeed;
        } else if (proneHeld && camera.onGround) {
          this.setPhase('prone');
        }
        break;

      case 'diving':
        camera.speedMultiplier = 1;
        if (camera.onGround) {
          this.setPhase(proneHeld ? 'prone' : 'recovering');
          this.recoveryTimer = this.options.recoveryTime;
          if (this.phase !== 'prone') camera.speedMultiplier = 1;
        }
        break;

      case 'prone':
        camera.speedMultiplier = this.options.proneMoveMultiplier;
        if (!proneHeld) {
          this.recoveryTimer = this.options.recoveryTime;
          this.setPhase('recovering');
        }
        break;

      case 'recovering':
        camera.speedMultiplier = this.options.proneMoveMultiplier;
        this.recoveryTimer -= dt;
        if (this.recoveryTimer <= 0) {
          camera.speedMultiplier = 1;
          this.setPhase('ready');
        }
        break;
    }

    const proneBlend = this.phase === 'diving' || this.phase === 'prone' ? 10 : 4;
    camera.eyeHeight += (this.targetEyeHeight() - camera.eyeHeight) * Math.min(1, proneBlend * dt);
  }

  private targetEyeHeight(): number {
    return this.phase === 'diving' || this.phase === 'prone'
      ? this.options.proneEyeHeight
      : this.options.standEyeHeight;
  }

  private setPhase(phase: DivePhase): void {
    this.phase = phase;
    this.options.onPhaseChange?.(phase);
  }
}
