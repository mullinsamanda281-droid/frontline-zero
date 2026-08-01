import { describe, expect, it } from 'vitest';
import { Lobby } from './lobby';
import { MatchRoom, INPUT_BIT_FORWARD } from './matchRoom';
import {
  decodeClientMsg,
  encodeServerMsg,
  packSnapshot,
  unpackSnapshot,
  validateClientMsg,
  type ServerMsg,
} from './protocol';
import { RateLimiter } from './rateLimit';

describe('protocol', () => {
  it('accepts a valid join message', () => {
    const msg = validateClientMsg({ type: 'join', name: 'Reaper', room: 'AB' });
    expect(msg).toEqual({ type: 'join', name: 'Reaper', room: 'AB' });
  });

  it('rejects malformed messages', () => {
    expect(validateClientMsg(null)).toBeNull();
    expect(validateClientMsg({ type: 'join', name: '' })).toBeNull();
    expect(validateClientMsg({ type: 'input', seq: 1.5, ts: 0, buttons: 0, yaw: 0, pitch: 0 })).toBeNull();
    expect(validateClientMsg({ type: 'input', seq: 1, ts: 0, buttons: 999, yaw: 0, pitch: 0 })).toBeNull();
    expect(validateClientMsg({ type: 'input', seq: 1, ts: 0, buttons: 0, yaw: 0, pitch: 2 })).toBeNull();
    expect(validateClientMsg({ type: 'unknown' })).toBeNull();
  });

  it('round-trips binary snapshots', () => {
    const snapshot = {
      tick: 1234,
      players: [
        { id: 'A0', name: 'REAPER-1', x: 1.25, y: 1.6, z: -3.5, yaw: 1.2, pitch: -0.3, hp: 100, alive: true },
        { id: 'B3', name: 'VIPER-3', x: -20, y: 0, z: 30, yaw: -2.5, pitch: 0.7, hp: 55, alive: false },
      ],
    };
    const buffer = packSnapshot(snapshot);
    const unpacked = unpackSnapshot(buffer);
    expect(unpacked.tick).toBe(1234);
    expect(unpacked.players.length).toBe(2);
    expect(unpacked.players[0].id).toBe('A0');
    expect(unpacked.players[0].name).toBe('REAPER-1');
    expect(Math.abs(unpacked.players[0].x - 1.25)).toBeLessThan(0.01);
    expect(Math.abs(unpacked.players[1].pitch - 0.7)).toBeLessThan(0.02);
    expect(unpacked.players[1].alive).toBe(false);
  });

  it('server messages encode as JSON', () => {
    const msg: ServerMsg = { type: 'welcome', playerId: 'A0', players: [] };
    expect(JSON.parse(encodeServerMsg(msg))).toEqual(msg);
  });

  it('decodes client messages from strings and rejects oversized payloads', () => {
    expect(decodeClientMsg('{"type":"ready"}')).toEqual({ type: 'ready' });
    expect(decodeClientMsg('not json')).toBeNull();
    expect(decodeClientMsg('x'.repeat(1000))).toBeNull();
  });
});

describe('MatchRoom', () => {
  it('adds players at distinct spawns and simulates movement from input', () => {
    const room = new MatchRoom({ warmupSeconds: 1, matchSeconds: 60, scoreLimit: 5 });
    const a = room.addPlayer('Alice');
    const b = room.addPlayer('Bob');
    expect(a.id).not.toBe(b.id);
    const startZ = a.camera.position.z;
    for (let i = 0; i < 60; i++) {
      room.applyInput(a.id, i, INPUT_BIT_FORWARD, 0, 0);
      room.update(1 / 30);
    }
    expect(Math.abs(a.camera.position.z - startZ)).toBeGreaterThan(1);
    room.update(1 / 30);
    expect(room.tick).toBe(61);
  });

  it('ignores stale input sequences', () => {
    const room = new MatchRoom({ warmupSeconds: 1, matchSeconds: 60, scoreLimit: 5 });
    const a = room.addPlayer('Alice');
    const startZ = a.camera.position.z;
    room.applyInput(a.id, 10, INPUT_BIT_FORWARD, 0, 0);
    for (let i = 0; i < 10; i++) room.update(1 / 30);
    const afterNew = a.camera.position.z;
    room.applyInput(a.id, 5, INPUT_BIT_FORWARD, 0, 0);
    for (let i = 0; i < 10; i++) room.update(1 / 30);
    expect(a.camera.position.z).toBeCloseTo(afterNew, 2);
    expect(Math.abs(a.camera.position.z - startZ)).toBeGreaterThan(0.1);
  });

  it('damage kills, broadcasts kill events, and respawns away from shooter', () => {
    const room = new MatchRoom({ warmupSeconds: 0.5, matchSeconds: 60, scoreLimit: 5 });
    const a = room.addPlayer('Alice');
    const b = room.addPlayer('Bob');
    for (let i = 0; i < 30; i++) room.update(1 / 30);
    expect(room.match.phase).toBe('playing');
    room.damage(a.id, b.id, 100);
    const events = room.drainEvents();
    const kill = events.find((e) => e.kind === 'kill');
    expect(kill).toBeDefined();
    expect(b.killDeath.deaths).toBe(1);
    expect(b.alive).toBe(true);
    expect(b.hp).toBe(100);
    expect(a.killDeath.kills).toBe(1);
    expect(room.match.alphaScore).toBe(1);
    const bDist = Math.hypot(b.camera.position.x - a.camera.position.x, b.camera.position.z - a.camera.position.z);
    expect(bDist).toBeGreaterThan(25);
  });

  it('snapshot reflects authoritative state', () => {
    const room = new MatchRoom({ warmupSeconds: 1, matchSeconds: 60, scoreLimit: 5 });
    const a = room.addPlayer('Alice');
    room.applyInput(a.id, 0, INPUT_BIT_FORWARD, 0.5, -0.2);
    room.update(1 / 30);
    const snap = room.snapshot();
    expect(snap.players).toHaveLength(1);
    expect(snap.players[0].id).toBe(a.id);
    expect(snap.players[0].yaw).toBeCloseTo(0.5);
    expect(snap.players[0].pitch).toBeCloseTo(-0.2);
  });
});

describe('Lobby', () => {
  it('creates rooms on demand and limits capacity', () => {
    const lobby = new Lobby({ defaultRoom: 'def' });
    expect(lobby.getRoom('XYZ')).toBeDefined();
    const room = new MatchRoom({ maxPlayers: 2 });
    lobby.rooms.set('TINY', room);
    lobby.join('TINY', 'A');
    lobby.join('TINY', 'B');
    expect(() => lobby.join('TINY', 'C')).toThrow('room full');
  });

  it('removes empty custom rooms', () => {
    const lobby = new Lobby({ defaultRoom: 'def' });
    const { player } = lobby.join('X1', 'A');
    lobby.leave('X1', player.id);
    expect(lobby.rooms.has('X1')).toBe(false);
    expect(lobby.rooms.has('def')).toBe(true);
  });
});

describe('RateLimiter', () => {
  it('allows up to the window limit then blocks', () => {
    const limiter = new RateLimiter(3, 1000);
    expect(limiter.allow('k')).toBe(true);
    expect(limiter.allow('k')).toBe(true);
    expect(limiter.allow('k')).toBe(true);
    expect(limiter.allow('k')).toBe(false);
  });

  it('resets the window after expiry', () => {
    const limiter = new RateLimiter(1, 50);
    limiter.allow('k');
    expect(limiter.allow('k')).toBe(false);
    return new Promise((resolve) => {
      setTimeout(() => {
        expect(limiter.allow('k')).toBe(true);
        resolve(null);
      }, 60);
    });
  });
});
