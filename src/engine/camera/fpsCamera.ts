import { Stamina } from '../movement/stamina';
import { Vec3 } from './vec3';

export interface FpsInputState {
  forward: boolean;
  back: boolean;
  left: boolean;
  right: boolean;
  jump: boolean;
  sprint: boolean;
}

export interface FpsCameraOptions {
  moveSpeed?: number;
  sprintMultiplier?: number;
  jumpSpeed?: number;
  gravity?: number;
  pitchLimit?: number;
  sprintAcceleration?: number;
  staminaDrainPerSec?: number;
  staminaRegenPerSec?: number;
  enforceStamina?: boolean;
  staminaChangeListener?: (ratio: number) => void;
}

interface ResolvedOptions {
  moveSpeed: number;
  sprintMultiplier: number;
  jumpSpeed: number;
  gravity: number;
  pitchLimit: number;
  sprintAcceleration: number;
  enforceStamina: boolean;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export class FpsCamera {
  readonly position = new Vec3(0, 0, 0);
  readonly velocity = new Vec3(0, 0, 0);
  yaw = 0;
  pitch = 0;
  onGround = true;
  sprintFactor = 1;
  eyeHeight = 1.6;
  speedMultiplier = 1;
  readonly stamina: Stamina;
  private readonly options: ResolvedOptions;

  constructor(options: FpsCameraOptions = {}) {
    this.options = {
      moveSpeed: 6,
      sprintMultiplier: 1.7,
      jumpSpeed: 5,
      gravity: 15,
      pitchLimit: 89,
      sprintAcceleration: 8,
      enforceStamina: true,
      ...options,
    };
    this.stamina = new Stamina(
      options.staminaDrainPerSec ?? 0.45,
      options.staminaRegenPerSec ?? 0.6,
      options.staminaChangeListener,
    );
  }

  look(dx: number, dy: number, sensitivity = 0.002): void {
    this.yaw -= dx * sensitivity;
    const limit = (this.options.pitchLimit * Math.PI) / 180;
    this.pitch = clamp(this.pitch - dy * sensitivity, -limit, limit);
  }

  get forward(): Vec3 {
    return new Vec3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }

  get right(): Vec3 {
    return new Vec3(Math.cos(this.yaw), 0, -Math.sin(this.yaw));
  }

  update(dt: number, input: FpsInputState): void {
    const wantsSprint = input.sprint && (!this.options.enforceStamina || !this.stamina.isExhausted);
    const targetFactor = wantsSprint ? this.options.sprintMultiplier : 1;
    const blend = Math.min(1, this.options.sprintAcceleration * dt);
    this.sprintFactor += (targetFactor - this.sprintFactor) * blend;
    this.stamina.update(dt, this.sprintFactor > 1.01);

    const forwardAxis = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const rightAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = this.options.moveSpeed * this.sprintFactor * this.speedMultiplier;
    const forward = this.forward;
    const right = this.right;

    let vx = forward.x * forwardAxis + right.x * rightAxis;
    let vz = forward.z * forwardAxis + right.z * rightAxis;
    const magnitude = Math.hypot(vx, vz);
    if (magnitude > 0) {
      vx = (vx / magnitude) * speed;
      vz = (vz / magnitude) * speed;
    }

    this.velocity.x = vx;
    this.velocity.z = vz;
    this.velocity.y -= this.options.gravity * dt;
    if (input.jump && this.onGround) {
      this.velocity.y = this.options.jumpSpeed;
      this.onGround = false;
    }

    this.position.x += this.velocity.x * dt;
    this.position.y += this.velocity.y * dt;
    this.position.z += this.velocity.z * dt;

    if (this.position.y <= 0) {
      this.position.y = 0;
      this.velocity.y = 0;
      this.onGround = true;
    }
  }
}
