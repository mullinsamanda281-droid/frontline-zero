import { type FpsCamera } from '../camera/fpsCamera';
import { Vec3 } from '../camera/vec3';

export type SlidePhase = 'ready' | 'sliding' | 'crouch' | 'cooldown';

export interface SlideOptions {
  burstSpeed?: number;
  duration?: number;
  friction?: number;
  downhillAccel?: number;
  downhillSpeedCap?: number;
  cooldown?: number;
  minSprintFactor?: number;
  slopeRadians?: () => number;
  onSlideStart?: () => void;
  onSlideEnd?: (intoCrouch: boolean) => void;
}

interface ResolvedSlideOptions {
  burstSpeed: number;
  duration: number;
  friction: number;
  downhillAccel: number;
  downhillSpeedCap: number;
  cooldown: number;
  minSprintFactor: number;
  slopeRadians: () => number;
  onSlideStart: () => void;
  onSlideEnd: (intoCrouch: boolean) => void;
}

export class SlideController {
  phase: SlidePhase = 'ready';
  private timer = 0;
  private cooldownTimer = 0;
  private slideSpeed = 0;
  private readonly slideDirection = new Vec3(0, 0, -1);
  private readonly options: ResolvedSlideOptions;

  constructor(options: SlideOptions = {}) {
    this.options = {
      burstSpeed: 8.5,
      duration: 0.6,
      friction: 2.5,
      downhillAccel: 6,
      downhillSpeedCap: 3,
      cooldown: 1.2,
      minSprintFactor: 1.3,
      slopeRadians: () => 0,
      onSlideStart: () => {},
      onSlideEnd: () => {},
      ...options,
    };
  }

  update(dt: number, camera: FpsCamera, crouchHeld: boolean): void {
    if (this.cooldownTimer > 0) {
      this.cooldownTimer = Math.max(0, this.cooldownTimer - dt);
      if (this.cooldownTimer === 0 && this.phase === 'cooldown') this.phase = 'ready';
    }

    switch (this.phase) {
      case 'ready':
        if (this.tryStart(camera, crouchHeld)) return;
        break;
      case 'sliding':
        this.updateSliding(dt, camera, crouchHeld);
        break;
      case 'crouch':
        if (!crouchHeld) {
          this.phase = 'cooldown';
          this.cooldownTimer = this.options.cooldown;
          this.options.onSlideEnd(false);
        }
        break;
      case 'cooldown':
        break;
    }
  }

  private tryStart(camera: FpsCamera, crouchHeld: boolean): boolean {
    if (!crouchHeld || camera.sprintFactor < this.options.minSprintFactor) return false;
    const horizontalSpeed = Math.hypot(camera.velocity.x, camera.velocity.z);
    if (horizontalSpeed > 0.1) {
      this.slideDirection.set(
        camera.velocity.x / horizontalSpeed,
        0,
        camera.velocity.z / horizontalSpeed,
      );
    } else {
      const forward = camera.forward;
      this.slideDirection.set(forward.x, 0, forward.z);
    }
    this.slideSpeed = this.options.burstSpeed;
    this.timer = this.options.duration;
    this.phase = 'sliding';
    camera.velocity.x = this.slideDirection.x * this.slideSpeed;
    camera.velocity.z = this.slideDirection.z * this.slideSpeed;
    this.options.onSlideStart();
    return true;
  }

  private updateSliding(dt: number, camera: FpsCamera, crouchHeld: boolean): void {
    const slope = Math.sin(this.options.slopeRadians());
    if (slope > 0) {
      this.slideSpeed += Math.min(this.options.downhillAccel * slope * dt, this.options.downhillSpeedCap);
    }
    this.slideSpeed = Math.max(0, this.slideSpeed - this.options.friction * dt);
    camera.velocity.x = this.slideDirection.x * this.slideSpeed;
    camera.velocity.z = this.slideDirection.z * this.slideSpeed;

    this.timer -= dt;
    if (this.timer <= 0) {
      if (crouchHeld) {
        this.phase = 'crouch';
        this.options.onSlideEnd(true);
      } else {
        this.phase = 'cooldown';
        this.cooldownTimer = this.options.cooldown;
        this.options.onSlideEnd(false);
      }
    }
  }
}
