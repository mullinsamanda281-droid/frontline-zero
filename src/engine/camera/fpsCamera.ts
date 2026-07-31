export class Vec3 {
  constructor(
    public x = 0,
    public y = 0,
    public z = 0,
  ) {}

  clone(): Vec3 {
    return new Vec3(this.x, this.y, this.z);
  }
}

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
}

interface ResolvedOptions {
  moveSpeed: number;
  sprintMultiplier: number;
  jumpSpeed: number;
  gravity: number;
  pitchLimit: number;
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
  private readonly options: ResolvedOptions;

  constructor(options: FpsCameraOptions = {}) {
    this.options = {
      moveSpeed: 6,
      sprintMultiplier: 1.7,
      jumpSpeed: 5,
      gravity: 15,
      pitchLimit: 89,
      ...options,
    };
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
    const forwardAxis = (input.forward ? 1 : 0) - (input.back ? 1 : 0);
    const rightAxis = (input.right ? 1 : 0) - (input.left ? 1 : 0);
    const speed = this.options.moveSpeed * (input.sprint ? this.options.sprintMultiplier : 1);
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
