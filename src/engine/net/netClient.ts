import type { MatchEvent, PlayerState } from '../../../server/protocol';

export interface NetClientEvents {
  onWelcome(playerId: string, players: PlayerState[]): void;
  onSnapshot(tick: number, players: PlayerState[], events: MatchEvent[]): void;
  onJoinNotice(player: PlayerState): void;
  onLeaveNotice(playerId: string): void;
  onPong(t: number): void;
  onDisconnect(): void;
}

export interface NetClientOptions {
  url: string;
  name: string;
  room: string;
  inputRate?: number;
}

const INPUT_BITS = {
  forward: 1,
  back: 2,
  left: 4,
  right: 8,
  jump: 16,
  sprint: 32,
} as const;

export class NetClient {
  readonly events: NetClientEvents;
  private readonly url: string;
  private readonly name: string;
  private readonly room: string;
  private readonly inputRate: number;
  private socket: WebSocket | null = null;
  private seq = 0;
  private connected = false;
  private inputTimer: ReturnType<typeof setInterval> | null = null;
  private lastInput: { buttons: number; yaw: number; pitch: number } | null = null;
  private pendingPings = 0;
  private latencyMsValue = 0;
  _lastPing = 0;

  constructor(options: NetClientOptions, events: NetClientEvents) {
    this.url = options.url;
    this.name = options.name;
    this.room = options.room;
    this.inputRate = options.inputRate ?? 30;
    this.events = events;
  }

  get latencyMs(): number {
    return this.latencyMsValue;
  }

  get isConnected(): boolean {
    return this.connected;
  }

  connect(): void {
    this.socket = new WebSocket(this.url);
    this.socket.binaryType = 'arraybuffer';
    this.socket.addEventListener('open', () => {
      this.socket?.send(JSON.stringify({ type: 'join', name: this.name, room: this.room }));
    });
    this.socket.addEventListener('message', (event) => this.handleMessage(event.data));
    this.socket.addEventListener('close', () => {
      this.connected = false;
      if (this.inputTimer) clearInterval(this.inputTimer);
      this.inputTimer = null;
      this.events.onDisconnect();
    });
  }

  sendInput(input: { forward: boolean; back: boolean; left: boolean; right: boolean; jump: boolean; sprint: boolean; yaw: number; pitch: number }): void {
    if (!this.connected) return;
    let buttons = 0;
    if (input.forward) buttons |= INPUT_BITS.forward;
    if (input.back) buttons |= INPUT_BITS.back;
    if (input.left) buttons |= INPUT_BITS.left;
    if (input.right) buttons |= INPUT_BITS.right;
    if (input.jump) buttons |= INPUT_BITS.jump;
    if (input.sprint) buttons |= INPUT_BITS.sprint;
    this.lastInput = { buttons, yaw: input.yaw, pitch: input.pitch };
    if (this.inputTimer === null) {
      this.inputTimer = setInterval(() => this.flushInput(), 1000 / this.inputRate);
    }
  }

  ping(): void {
    if (!this.connected) return;
    this.pendingPings++;
    this.socket?.send(JSON.stringify({ type: 'ping', t: performance.now() }));
  }

  private flushInput(): void {
    if (!this.connected || !this.socket || !this.lastInput) return;
    this.socket.send(
      JSON.stringify({
        type: 'input',
        seq: this.seq++,
        ts: performance.now(),
        buttons: this.lastInput.buttons,
        yaw: this.lastInput.yaw,
        pitch: this.lastInput.pitch,
      }),
    );
  }

  private handleMessage(data: unknown): void {
    let msg: unknown;
    if (data instanceof ArrayBuffer) {
      msg = JSON.parse(new TextDecoder().decode(data));
    } else if (typeof data === 'string') {
      msg = JSON.parse(data);
    } else {
      return;
    }
    const type = (msg as { type?: string }).type;
    switch (type) {
      case 'welcome': {
        const m = msg as { playerId: string; players: PlayerState[] };
        this.connected = true;
        this.events.onWelcome(m.playerId, m.players);
        break;
      }
      case 'snapshot': {
        const m = msg as { tick: number; players: PlayerState[]; events: MatchEvent[] };
        this.events.onSnapshot(m.tick, m.players, m.events);
        break;
      }
      case 'join_notice': {
        this.events.onJoinNotice((msg as { player: PlayerState }).player);
        break;
      }
      case 'leave_notice': {
        this.events.onLeaveNotice((msg as { playerId: string }).playerId);
        break;
      }
      case 'pong': {
        const t = (msg as { t: number }).t;
        const rtt = performance.now() - t;
        this.pendingPings = Math.max(0, this.pendingPings - 1);
        this.latencyMsValue = this.latencyMsValue === 0 ? rtt : this.latencyMsValue * 0.8 + rtt * 0.2;
        this.events.onPong(t);
        break;
      }
    }
  }
}
