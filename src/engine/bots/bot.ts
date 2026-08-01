import { Vec3 } from '../camera/vec3';
import { WeaponRuntime } from '../weapons/weapon';
import { WEAPONS } from '../weapons/weapons';

export type BotDifficulty = 'easy' | 'medium' | 'hard';
export type BotState = 'patrol' | 'engage' | 'retreat';

export interface BotContext {
  playerPosition: Vec3;
  lineOfSight: boolean;
  shootPlayer(damage: number): void;
}

export interface BotOptions {
  name?: string;
  difficulty?: BotDifficulty;
  team?: 'alpha' | 'bravo';
  waypoints?: Vec3[];
  visionRange?: number;
  accuracy?: number;
  damage?: number;
  fireRate?: number;
  moveSpeed?: number;
  retreatHealth?: number;
}

interface ResolvedBotOptions {
  name: string;
  difficulty: BotDifficulty;
  team: 'alpha' | 'bravo';
  waypoints: Vec3[];
  visionRange: number;
  accuracy: number;
  damage: number;
  fireRate: number;
  moveSpeed: number;
  retreatHealth: number;
}

const DIFFICULTY: Record<BotDifficulty, Partial<ResolvedBotOptions>> = {
  easy: { visionRange: 30, accuracy: 0.12, damage: 9, fireRate: 4, moveSpeed: 4.2 },
  medium: { visionRange: 45, accuracy: 0.06, damage: 12, fireRate: 5, moveSpeed: 4.8 },
  hard: { visionRange: 60, accuracy: 0.02, damage: 16, fireRate: 6, moveSpeed: 5.2 },
};

export class Bot {
  readonly options: ResolvedBotOptions;
  readonly weapon = new WeaponRuntime(WEAPONS.ar);
  readonly position = new Vec3(0, 0, 0);
  yaw = 0;
  health = 100;
  state: BotState = 'patrol';
  alive = true;
  respawnTimer = 0;
  private strafeDir = 1;
  private strafeTimer = 0;
  private patrolIndex = 0;
  private patrolWait = 0;
  private aimBlend = 0;
  private shootTimer = 0;
  private readonly rng: () => number;

  constructor(options: BotOptions = {}, rng: () => number = Math.random) {
    this.rng = rng;
    const base: ResolvedBotOptions = {
      name: 'Bot',
      difficulty: 'medium',
      team: 'bravo',
      waypoints: [
        new Vec3(-30, 0, -20),
        new Vec3(30, 0, -20),
        new Vec3(30, 0, 20),
        new Vec3(-30, 0, 20),
      ],
      visionRange: 45,
      accuracy: 0.06,
      damage: 12,
      fireRate: 5,
      moveSpeed: 4.8,
      retreatHealth: 30,
    };
    this.options = { ...base, ...DIFFICULTY[options.difficulty ?? 'medium'], ...options };
    this.position.set(
      this.options.waypoints[0].x,
      0,
      this.options.waypoints[0].z,
    );
  }

  takeDamage(amount: number): void {
    if (!this.alive) return;
    this.health -= amount;
    if (this.health <= 0) {
      this.health = 0;
      this.alive = false;
      this.respawnTimer = 3;
    }
  }

  update(dt: number, ctx: BotContext): void {
    if (!this.alive) {
      this.respawnTimer -= dt;
      return;
    }

    const distance = Math.hypot(
      ctx.playerPosition.x - this.position.x,
      ctx.playerPosition.z - this.position.z,
    );
    const seesPlayer = ctx.lineOfSight && distance <= this.options.visionRange;

    if (this.state === 'patrol') {
      if (seesPlayer) {
        this.state = 'engage';
      } else {
        this.patrol(dt);
      }
    } else if (this.state === 'engage') {
      if (this.health <= this.options.retreatHealth) {
        this.state = 'retreat';
      } else if (!seesPlayer) {
        this.state = 'patrol';
      } else {
        this.engage(dt, ctx, distance);
      }
    } else if (this.state === 'retreat') {
      if (this.health > this.options.retreatHealth + 20) {
        this.state = 'engage';
      } else if (seesPlayer) {
        const away = new Vec3(
          this.position.x - ctx.playerPosition.x,
          0,
          this.position.z - ctx.playerPosition.z,
        ).normalized();
        this.moveToward(away, this.options.moveSpeed, dt);
        this.turnToward(ctx.playerPosition, dt);
      } else {
        this.state = 'patrol';
      }
    }

    this.weapon.update(dt, { moving: true, triggerHeld: this.state === 'engage' && seesPlayer });
  }

  private patrol(dt: number): void {
    const target = this.options.waypoints[this.patrolIndex % this.options.waypoints.length];
    const dx = target.x - this.position.x;
    const dz = target.z - this.position.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 1.5) {
      this.patrolWait -= dt;
      if (this.patrolWait <= 0) {
        this.patrolIndex++;
        this.patrolWait = 2;
      }
      return;
    }
    const dir = new Vec3(dx / dist, 0, dz / dist);
    this.moveToward(dir, this.options.moveSpeed * 0.6, dt);
    this.yaw = Math.atan2(dir.x, dir.z);
  }

  private engage(dt: number, ctx: BotContext, distance: number): void {
    this.turnToward(ctx.playerPosition, dt);

    this.strafeTimer -= dt;
    if (this.strafeTimer <= 0) {
      this.strafeTimer = 1 + this.rng() * 2;
      this.strafeDir = this.rng() > 0.5 ? 1 : -1;
    }

    const desired = 14;
    const forward = distance > desired + 3 ? 1 : distance < desired - 3 ? -1 : 0;
    const moveDir = new Vec3(
      -Math.sin(this.yaw) * forward + Math.cos(this.yaw) * this.strafeDir * 0.7,
      0,
      -Math.cos(this.yaw) * forward - Math.sin(this.yaw) * this.strafeDir * 0.7,
    );
    this.moveToward(moveDir, this.options.moveSpeed, dt);

    if (ctx.lineOfSight) {
      this.shootTimer -= dt;
      if (this.shootTimer <= 0) {
        this.shootTimer = 1 / this.options.fireRate;
        this.fire(ctx);
      }
    }
  }

  private fire(ctx: BotContext): void {
    if (this.rng() > this.options.accuracy * 2.5) {
      ctx.shootPlayer(this.options.damage);
    }
  }

  private moveToward(dir: Vec3, speed: number, dt: number): void {
    this.position.x += dir.x * speed * dt;
    this.position.z += dir.z * speed * dt;
  }

  private turnToward(target: Vec3, dt: number): void {
    const targetYaw = Math.atan2(target.x - this.position.x, target.z - this.position.z);
    let diff = targetYaw - this.yaw;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    this.aimBlend = Math.min(1, this.aimBlend + 6 * dt);
    this.yaw += diff * Math.min(1, 8 * dt) * this.aimBlend;
  }

  get facingForward(): Vec3 {
    return new Vec3(-Math.sin(this.yaw), 0, -Math.cos(this.yaw));
  }
}
