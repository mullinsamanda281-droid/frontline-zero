export type ClientMsg =
  | { type: 'join'; name: string; room: string }
  | { type: 'ready' }
  | { type: 'input'; seq: number; ts: number; buttons: number; yaw: number; pitch: number }
  | { type: 'ping'; t: number };

export type ServerMsg =
  | { type: 'welcome'; playerId: string; players: PlayerState[] }
  | { type: 'snapshot'; tick: number; players: PlayerState[]; events: MatchEvent[] }
  | { type: 'join_notice'; player: PlayerState }
  | { type: 'leave_notice'; playerId: string }
  | { type: 'match_start'; tick: number }
  | { type: 'match_end'; winner: 'alpha' | 'bravo' | null; alphaScore: number; bravoScore: number }
  | { type: 'pong'; t: number };

export interface PlayerState {
  id: string;
  name: string;
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  hp: number;
  alive: boolean;
}

export type MatchEvent =
  | { kind: 'kill'; killer: string; victim: string; team: 'alpha' | 'bravo' }
  | { kind: 'damage'; victim: string; amount: number; shooter: string }
  | { kind: 'join'; playerId: string }
  | { kind: 'leave'; playerId: string }
  | { kind: 'disconnect'; playerId: string }
  | { kind: 'respawn'; playerId: string }
  | { kind: 'spectate'; playerId: string; targetId: string | null }
  | { kind: 'match_end'; winner: 'alpha' | 'bravo' | null };

const NAME_MAX = 24;
const MSG_MAX = 512;

export function validateClientMsg(raw: unknown): ClientMsg | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const msg = raw as Record<string, unknown>;
  const type = msg.type;
  if (type === 'join') {
    const name = typeof msg.name === 'string' ? msg.name.slice(0, NAME_MAX) : '';
    const room = typeof msg.room === 'string' ? msg.room.slice(0, 16).toUpperCase() : 'default';
    if (name.length === 0) return null;
    return { type, name, room };
  }
  if (type === 'ready') {
    return { type };
  }
  if (type === 'ping') {
    if (typeof msg.t !== 'number' || !Number.isFinite(msg.t)) return null;
    return { type, t: msg.t };
  }
  if (type === 'input') {
    if (typeof msg.seq !== 'number' || !Number.isInteger(msg.seq)) return null;
    if (typeof msg.ts !== 'number' || !Number.isFinite(msg.ts)) return null;
    if (typeof msg.buttons !== 'number' || !Number.isInteger(msg.buttons) || msg.buttons < 0 || msg.buttons > 63) {
      return null;
    }
    if (typeof msg.yaw !== 'number' || !Number.isFinite(msg.yaw)) return null;
    if (typeof msg.pitch !== 'number' || !Number.isFinite(msg.pitch) || Math.abs(msg.pitch) > Math.PI / 2 + 0.01) {
      return null;
    }
    return { type, seq: msg.seq, ts: msg.ts, buttons: msg.buttons, yaw: msg.yaw, pitch: msg.pitch };
  }
  return null;
}

export function encodeServerMsg(msg: ServerMsg): string {
  return JSON.stringify(msg);
}

export function decodeClientMsg(data: unknown): ClientMsg | null {
  let raw: unknown;
  if (typeof data === 'string') {
    if (data.length > MSG_MAX) return null;
    try {
      raw = JSON.parse(data);
    } catch {
      return null;
    }
  } else if (data instanceof ArrayBuffer) {
    try {
      raw = JSON.parse(new TextDecoder().decode(data));
    } catch {
      return null;
    }
  } else if (ArrayBuffer.isView(data)) {
    return decodeClientMsg((data as Uint8Array).buffer.slice((data as Uint8Array).byteOffset, (data as Uint8Array).byteOffset + (data as Uint8Array).byteLength));
  } else {
    return null;
  }
  return validateClientMsg(raw);
}

export function packSnapshot(snapshot: { tick: number; players: PlayerState[] }): ArrayBuffer {
  const NAME_BYTES = 16;
  const FIXED = 6;
  const PER_PLAYER = 2 + NAME_BYTES + 4 + 4 + 4 + 2 + 2 + 1 + 1;
  const buffer = new ArrayBuffer(FIXED + snapshot.players.length * PER_PLAYER);
  const view = new DataView(buffer);
  let offset = 0;
  view.setUint32(offset, snapshot.tick, true);
  offset += 4;
  view.setUint16(offset, snapshot.players.length, true);
  offset += 2;
  const encoder = new TextEncoder();
  for (const p of snapshot.players) {
    view.setUint16(offset, p.id.charCodeAt(0) * 256 + (p.id.charCodeAt(1) ?? 0), true);
    offset += 2;
    const nameBytes = encoder.encode(p.name.padEnd(NAME_BYTES, '\0').slice(0, NAME_BYTES));
    new Uint8Array(buffer, offset, NAME_BYTES).set(nameBytes);
    offset += NAME_BYTES;
    view.setFloat32(offset, p.x, true);
    offset += 4;
    view.setFloat32(offset, p.z, true);
    offset += 4;
    view.setFloat32(offset, p.y, true);
    offset += 4;
    view.setInt16(offset, Math.round(p.yaw * 32767 / Math.PI), true);
    offset += 2;
    view.setInt16(offset, Math.round(p.pitch * 32767 / (Math.PI / 2)), true);
    offset += 2;
    view.setUint8(offset, clampByte(p.hp));
    offset += 1;
    view.setUint8(offset, p.alive ? 1 : 0);
    offset += 1;
  }
  return buffer;
}

export function unpackSnapshot(buffer: ArrayBuffer): { tick: number; players: PlayerState[] } {
  const NAME_BYTES = 16;
  const view = new DataView(buffer);
  let offset = 0;
  const tick = view.getUint32(offset, true);
  offset += 4;
  const count = view.getUint16(offset, true);
  offset += 2;
  const decoder = new TextDecoder();
  const players: PlayerState[] = [];
  for (let i = 0; i < count; i++) {
    const idCode = view.getUint16(offset, true);
    offset += 2;
    const name = decoder.decode(new Uint8Array(buffer, offset, NAME_BYTES)).replace(/\0+$/, '');
    offset += NAME_BYTES;
    const x = view.getFloat32(offset, true);
    offset += 4;
    const z = view.getFloat32(offset, true);
    offset += 4;
    const y = view.getFloat32(offset, true);
    offset += 4;
    const yaw = (view.getInt16(offset, true) / 32767) * Math.PI;
    offset += 2;
    const pitch = (view.getInt16(offset, true) / 32767) * (Math.PI / 2);
    offset += 2;
    const hp = view.getUint8(offset);
    offset += 1;
    const alive = view.getUint8(offset) === 1;
    offset += 1;
    players.push({
      id: String.fromCharCode(idCode >> 8, idCode & 0xff),
      name,
      x,
      y,
      z,
      yaw,
      pitch,
      hp,
      alive,
    });
  }
  return { tick, players };
}

function clampByte(value: number): number {
  return Math.max(0, Math.min(255, Math.round(value)));
}
