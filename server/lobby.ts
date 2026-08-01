import { MatchRoom, type RoomPlayer } from './matchRoom';

export interface LobbyOptions {
  defaultRoom?: string;
  roomTtlMs?: number;
}

export class Lobby {
  readonly rooms = new Map<string, MatchRoom>();
  private readonly created = new Map<string, number>();
  private readonly defaultRoom: string;
  private readonly roomTtlMs: number;

  constructor(options: LobbyOptions = {}) {
    this.defaultRoom = options.defaultRoom ?? 'default';
    this.roomTtlMs = options.roomTtlMs ?? 5 * 60_000;
    this.rooms.set(this.defaultRoom, new MatchRoom({ maxPlayers: 8 }));
    this.created.set(this.defaultRoom, Date.now());
  }

  getRoom(code: string): MatchRoom {
    const key = code.length > 0 ? code : this.defaultRoom;
    let room = this.rooms.get(key);
    if (!room) {
      room = new MatchRoom({ maxPlayers: 8 });
      this.rooms.set(key, room);
      this.created.set(key, Date.now());
    }
    return room;
  }

  join(code: string, name: string): { player: RoomPlayer; room: MatchRoom } {
    const room = this.getRoom(code);
    if (room.players.length >= room.maxPlayers) {
      throw new Error('room full');
    }
    const player = room.addPlayer(name);
    return { player, room };
  }

  leave(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.removePlayer(playerId);
    if (room.players.length === 0 && roomCode !== this.defaultRoom) {
      this.rooms.delete(roomCode);
      this.created.delete(roomCode);
    }
  }

  disconnectPlayer(roomCode: string, playerId: string): void {
    const room = this.rooms.get(roomCode);
    if (!room) return;
    room.events.push({ kind: 'disconnect', playerId } as never);
  }

  update(dt: number): void {
    const now = Date.now();
    for (const [code, room] of this.rooms) {
      room.update(dt);
      if (code !== this.defaultRoom && room.players.length === 0 && now - (this.created.get(code) ?? now) > this.roomTtlMs) {
        this.rooms.delete(code);
        this.created.delete(code);
      }
    }
  }
}
