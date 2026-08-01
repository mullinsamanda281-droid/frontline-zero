import { WebSocketServer, type WebSocket } from 'ws';
import { Lobby } from './lobby';
import { RateLimiter } from './rateLimit';
import type { MatchRoom, RoomPlayer } from './matchRoom';
import { decodeClientMsg, encodeServerMsg } from './protocol';

export interface ServerOptions {
  port?: number;
  tickMs?: number;
}

interface Connection {
  socket: WebSocket;
  player: RoomPlayer | null;
  room: MatchRoom | null;
  roomCode: string;
  lastSentTick: number;
}

export class MatchServer {
  readonly lobby = new Lobby();
  private readonly wss: WebSocketServer;
  private readonly tickMs: number;
  private readonly limiter = new RateLimiter(120, 1000);
  private readonly connections = new Map<WebSocket, Connection>();
  private tickTimer: ReturnType<typeof setInterval> | null = null;

  constructor(options: ServerOptions = {}) {
    this.wss = new WebSocketServer({ port: options.port ?? 8080 });
    this.tickMs = options.tickMs ?? 33;
    this.wss.on('connection', (socket) => this.handleConnection(socket));
    this.tickTimer = setInterval(() => this.broadcastTick(), this.tickMs);
    this.wss.on('listening', () => {
      console.log('MatchServer listening on', (this.wss.address() as { port: number }).port);
    });
  }

  get port(): number {
    const addr = this.wss.address();
    if (!addr) return 0;
    return typeof addr === 'string' ? 0 : addr.port;
  }

  close(): void {
    if (this.tickTimer) clearInterval(this.tickTimer);
    this.wss.close();
  }

  private handleConnection(socket: WebSocket): void {
    const conn: Connection = { socket, player: null, room: null, roomCode: '', lastSentTick: -1 };
    this.connections.set(socket, conn);
    socket.on('message', (data) => {
      if (!this.limiter.allow(socket)) {
        socket.close(1008, 'rate limited');
        return;
      }
      const msg = decodeClientMsg(data);
      if (msg === null) {
        console.log('invalid msg from', conn.player?.id, data);
        socket.close(1008, 'invalid message');
        return;
      }

      this.dispatch(conn, msg);
    });
    socket.on('close', () => {
      this.connections.delete(socket);
      if (conn.player && conn.room) {
        this.lobby.leave(conn.roomCode, conn.player.id);
        this.broadcast(conn.room, { type: 'leave_notice', playerId: conn.player.id });
      }
    });
  }

  private dispatch(
    conn: Connection,
    msg:
      | { type: 'join'; name: string; room: string }
      | { type: 'ready' }
      | { type: 'input'; seq: number; ts: number; buttons: number; yaw: number; pitch: number }
      | { type: 'ping'; t: number },
  ): void {
    switch (msg.type) {
      case 'join': {
        if (conn.player) return;
        try {
          const { player, room } = this.lobby.join(msg.room, msg.name);
          conn.player = player;
          conn.room = room;
          conn.roomCode = msg.room;
          this.socketSend(conn, { type: 'welcome', playerId: player.id, players: room.snapshot().players });
          const joined = room.snapshot().players.find((p) => p.id === player.id);
          if (joined) {
            this.broadcast(room, { type: 'join_notice', player: joined });
          }
        } catch (err) {
          conn.socket.close(1008, err instanceof Error ? err.message : 'join failed');
        }
        break;
      }
      case 'ready': {
        if (conn.player && conn.room) {
          conn.room.match.skipWarmup();
        }
        break;
      }
      case 'input': {
        if (conn.player && conn.room) {
          conn.room.applyInput(conn.player.id, msg.seq, msg.buttons, msg.yaw, msg.pitch);
        }
        break;
      }
      case 'ping': {
        this.socketSend(conn, { type: 'pong', t: msg.t });
        break;
      }
    }
  }

  private broadcastTick(): void {
    for (const [, conn] of this.connections) {
      if (!conn.room || !conn.player) continue;
      if (conn.room.tick === conn.lastSentTick) continue;
      const snapshot = conn.room.snapshot();
      conn.lastSentTick = conn.room.tick;
      this.socketSend(conn, { type: 'snapshot', tick: snapshot.tick, players: snapshot.players, events: conn.room.drainEvents() });
    }
  }

  private broadcast(room: MatchRoom, msg: Parameters<typeof encodeServerMsg>[0]): void {
    for (const [, conn] of this.connections) {
      if (conn.room === room) this.socketSend(conn, msg);
    }
  }

  private socketSend(conn: Connection, msg: Parameters<typeof encodeServerMsg>[0]): void {
    if (conn.socket.readyState !== conn.socket.OPEN) return;
    conn.socket.send(encodeServerMsg(msg));
  }
}

export function startServer(options?: ServerOptions): MatchServer {
  const envPort = process.env.PORT ? Number(process.env.PORT) : NaN;
  const port = options?.port ?? (Number.isFinite(envPort) ? envPort : 8080);
  return new MatchServer({ ...options, port });
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const server = startServer();
  console.log('MatchServer started on port', server.port);
}
