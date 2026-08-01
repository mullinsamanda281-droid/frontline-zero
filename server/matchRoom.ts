import { FpsCamera } from '../src/engine/camera/fpsCamera';
import { Vec3 } from '../src/engine/camera/vec3';
import { MatchManager } from '../src/engine/match/matchManager';
import { CollisionWorld, makeAABB } from '../src/engine/world/collision';
import { PLACEMENTS } from '../src/engine/world/portMap';
import type { MatchEvent, PlayerState } from './protocol';

export const INPUT_BIT_FORWARD = 1;
export const INPUT_BIT_BACK = 2;
export const INPUT_BIT_LEFT = 4;
export const INPUT_BIT_RIGHT = 8;
export const INPUT_BIT_JUMP = 16;
export const INPUT_BIT_SPRINT = 32;

export interface RoomPlayer {
  id: string;
  name: string;
  camera: FpsCamera;
  hp: number;
  alive: boolean;
  lastInputSeq: number;
  killDeath: { kills: number; deaths: number };
}

export interface MatchOptions {
  tickRate?: number;
  warmupSeconds?: number;
  matchSeconds?: number;
  scoreLimit?: number;
  maxPlayers?: number;
}

const SPAWNS = [
  new Vec3(0, 0, 0),
  new Vec3(25, 0, 0),
  new Vec3(-25, 0, 0),
  new Vec3(0, 0, 25),
  new Vec3(0, 0, -25),
  new Vec3(25, 0, 25),
  new Vec3(-25, 0, 25),
  new Vec3(25, 0, -25),
  new Vec3(-25, 0, -25),
];

export class MatchRoom {
  readonly players: RoomPlayer[] = [];
  readonly match: MatchManager;
  readonly collisionWorld = new CollisionWorld(
    PLACEMENTS.map((p) => makeAABB(p.x, p.h / 2, p.z, p.w, p.h, p.d)),
  );
  readonly tickRate: number;
  readonly maxPlayers: number;
  readonly events: MatchEvent[] = [];
  tick = 0;
  private acc = 0;
  private nextId = 0;

  constructor(options: MatchOptions = {}) {
    this.tickRate = options.tickRate ?? 30;
    this.maxPlayers = options.maxPlayers ?? 8;
    this.match = new MatchManager(
      {
        warmupSeconds: options.warmupSeconds ?? 3,
        matchSeconds: options.matchSeconds ?? 300,
        scoreLimit: options.scoreLimit ?? 30,
      },
      (phase, winner) => {
        if (phase === 'matchEnd') this.events.push({ kind: 'match_end', winner });
      },
    );
    this.match.start();
  }

  get state(): { phase: string; winner: 'alpha' | 'bravo' | null; alphaScore: number; bravoScore: number; timeRemaining: number } {
    return {
      phase: this.match.phase,
      winner: this.match.winner,
      alphaScore: this.match.alphaScore,
      bravoScore: this.match.bravoScore,
      timeRemaining: this.match.timeRemaining,
    };
  }

  addPlayer(name: string): RoomPlayer {
    if (this.players.length >= this.maxPlayers) throw new Error('room full');
    const id = String.fromCharCode(65 + Math.floor(this.nextId / 10), 48 + (this.nextId % 10));
    this.nextId++;
    const spawn = SPAWNS[this.players.length % SPAWNS.length];
    const camera = new FpsCamera({ jumpSpeed: 6.2 });
    camera.position.set(spawn.x, 0, spawn.z);
    camera.floorY = this.collisionWorld.heightAt(spawn.x, spawn.z);
    const player: RoomPlayer = {
      id,
      name,
      camera,
      hp: 100,
      alive: true,
      lastInputSeq: -1,
      killDeath: { kills: 0, deaths: 0 },
    };
    this.players.push(player);
    this.match.joinPlayer(id);
    this.events.push({ kind: 'join', playerId: id });
    return player;
  }

  removePlayer(id: string): void {
    const index = this.players.findIndex((p) => p.id === id);
    if (index >= 0) {
      this.players.splice(index, 1);
      this.events.push({ kind: 'leave', playerId: id });
    }
  }

  applyInput(id: string, seq: number, buttons: number, yaw: number, pitch: number): void {
    const player = this.players.find((p) => p.id === id);
    if (!player || !player.alive) return;
    if (seq <= player.lastInputSeq) return;
    player.lastInputSeq = seq;
    player.camera.yaw = yaw;
    player.camera.pitch = pitch;
    player.camera.update(1 / this.tickRate, {
      forward: (buttons & INPUT_BIT_FORWARD) !== 0,
      back: (buttons & INPUT_BIT_BACK) !== 0,
      left: (buttons & INPUT_BIT_LEFT) !== 0,
      right: (buttons & INPUT_BIT_RIGHT) !== 0,
      jump: (buttons & INPUT_BIT_JUMP) !== 0,
      sprint: (buttons & INPUT_BIT_SPRINT) !== 0,
    });
    const collision = this.collisionWorld.resolveCapsule(player.camera.position, 0.35, 1.8);
    player.camera.floorY = collision.floorY;
  }

  damage(shooterId: string, victimId: string, amount: number): void {
    if (this.match.phase !== 'playing') return;
    const victim = this.players.find((p) => p.id === victimId);
    if (!victim || !victim.alive) return;
    victim.hp -= amount;
    this.events.push({ kind: 'damage', victim: victimId, amount, shooter: shooterId });
    if (victim.hp <= 0) {
      victim.hp = 0;
      victim.alive = false;
      victim.killDeath.deaths++;
      this.match.kill('alpha', shooterId, victimId);
      this.events.push({ kind: 'kill', killer: shooterId, victim: victimId, team: 'alpha' });
      const killer = this.players.find((p) => p.id === shooterId);
      if (killer) killer.killDeath.kills++;
      this.respawn(victimId, killer?.camera.position ?? new Vec3(0, 0, 0));
    }
  }

  respawn(id: string, awayFrom: Vec3): void {
    const player = this.players.find((p) => p.id === id);
    if (!player) return;
    player.hp = 100;
    player.alive = true;
    this.events.push({ kind: 'respawn', playerId: id });
    const candidates = SPAWNS.slice();
    let best = candidates[0];
    let bestDist = -1;
    for (const c of candidates) {
      const d = Math.hypot(c.x - awayFrom.x, c.z - awayFrom.z);
      if (d > bestDist) {
        bestDist = d;
        best = c;
      }
    }
    player.camera.position.set(best.x, 0, best.z);
    player.camera.velocity.set(0, 0, 0);
    player.camera.floorY = this.collisionWorld.heightAt(best.x, best.z);
  }

  update(dt: number): void {
    this.acc += dt;
    const step = 1 / this.tickRate;
    while (this.acc >= step) {
      this.acc -= step;
      this.tickSim(step);
    }
  }

  private tickSim(step: number): void {
    this.tick++;
    for (const player of this.players) {
      if (!player.alive) {
        player.camera.update(step, { forward: false, back: false, left: false, right: false, jump: false, sprint: false });
        continue;
      }
      const collision = this.collisionWorld.resolveCapsule(player.camera.position, 0.35, 1.8);
      player.camera.floorY = collision.floorY;
    }
    this.match.update(step);
  }

  snapshot(): { tick: number; players: PlayerState[] } {
    return {
      tick: this.tick,
      players: this.players.map((p) => ({
        id: p.id,
        name: p.name,
        x: p.camera.position.x,
        y: p.camera.position.y,
        z: p.camera.position.z,
        yaw: p.camera.yaw,
        pitch: p.camera.pitch,
        hp: p.hp,
        alive: p.alive,
      })),
    };
  }

  drainEvents(): MatchEvent[] {
    const out = this.events.splice(0, this.events.length);
    return out;
  }
}
