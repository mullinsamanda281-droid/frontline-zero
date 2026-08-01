export type GameMode = 'tdm' | 'ffa' | 'coop';

export interface PlayerProgression {
  xp: number;
  level: number;
  kills: number;
  deaths: number;
  matchesPlayed: number;
  wins: number;
}

const XP_PER_KILL = 100;
const XP_PER_WIN = 500;
const XP_PER_MATCH = 50;
const XP_PER_LEVEL = 500;

export function xpForLevel(level: number): number {
  return level * XP_PER_LEVEL;
}

export function addXp(progression: PlayerProgression, amount: number): void {
  progression.xp += amount;
  while (progression.xp >= xpForLevel(progression.level)) {
    progression.xp -= xpForLevel(progression.level);
    progression.level++;
  }
}
export type MatchPhase = 'warmup' | 'playing' | 'matchEnd';

export type MatchEvent =
  | { kind: 'round_start'; tick: number }
  | { kind: 'round_end'; winner: 'alpha' | 'bravo' | null; tick: number }
  | { kind: 'kill'; killer: string; victim: string; team: 'alpha' | 'bravo'; tick: number }
  | { kind: 'damage'; victim: string; amount: number; shooter: string; tick: number }
  | { kind: 'player_join'; playerId: string; tick: number }
  | { kind: 'player_leave'; playerId: string; tick: number }
  | { kind: 'wave_start'; wave: number; tick: number }
  | { kind: 'match_start'; tick: number };

export type MatchEventListener = (event: MatchEvent) => void;

export interface MatchOptions {
  warmupSeconds?: number;
  matchSeconds?: number;
  scoreLimit?: number;
  mode?: GameMode;
}

interface ResolvedMatchOptions {
  warmupSeconds: number;
  matchSeconds: number;
  scoreLimit: number;
  mode: GameMode;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
}

export class MatchManager {
  phase: MatchPhase = 'warmup';
  alphaScore = 0;
  bravoScore = 0;
  ffaScore: number = 0;
  coopWave: number = 0;
  mode: GameMode = 'tdm';
  readonly progression = new Map<string, PlayerProgression>();
  timeRemaining = 0;
  winner: 'alpha' | 'bravo' | null = null;
  readonly players = new Map<string, PlayerStats>();
  private readonly options: ResolvedMatchOptions;
  private onPhaseChange: (phase: MatchPhase, winner: 'alpha' | 'bravo' | null) => void;
  private eventListeners: MatchEventListener[] = [];

  constructor(options: MatchOptions = {}, onPhaseChange: (phase: MatchPhase, winner: 'alpha' | 'bravo' | null) => void = () => {}) {
    this.options = {
      warmupSeconds: 10,
      matchSeconds: 300,
      scoreLimit: 50,
      mode: 'tdm',
      ...options,
    };
    this.onPhaseChange = onPhaseChange;
  }

  onEvent(listener: MatchEventListener): () => void {
    this.eventListeners.push(listener);
    return () => {
      const idx = this.eventListeners.indexOf(listener);
      if (idx >= 0) this.eventListeners.splice(idx, 1);
    };
  }



  start(): void {
    this.phase = 'warmup';
    this.timeRemaining = this.options.warmupSeconds;
    this.alphaScore = 0;
    this.bravoScore = 0;
    this.winner = null;
    this.players.clear();
    this.onPhaseChange('warmup', null);
  }

  skipWarmup(): void {
    if (this.phase === 'warmup') this.phase = 'playing';
  }

  joinPlayer(id: string): void {
    if (!this.players.has(id)) this.players.set(id, { kills: 0, deaths: 0 });
  }

  kill(killerTeam: 'alpha' | 'bravo', killerId: string | null, victimId: string | null): void {
    if (this.phase !== 'playing') return;
    if (killerTeam === 'alpha') this.alphaScore++;
    else this.bravoScore++;
    if (killerId) {
      const stats = this.players.get(killerId);
      if (stats) stats.kills++;
      const prog = this.progression.get(killerId) ?? { xp: 0, level: 1, kills: 0, deaths: 0, matchesPlayed: 0, wins: 0 };
      addXp(prog, XP_PER_KILL);
      this.progression.set(killerId, prog);
    }
    if (victimId) {
      const stats = this.players.get(victimId);
      if (stats) stats.deaths++;
      const prog = this.progression.get(victimId) ?? { xp: 0, level: 1, kills: 0, deaths: 0, matchesPlayed: 0, wins: 0 };
      addXp(prog, 0);
      this.progression.set(victimId, prog);
    }
    if (this.alphaScore >= this.options.scoreLimit || this.bravoScore >= this.options.scoreLimit) {
      this.endMatch();
    }
  }

  update(dt: number): void {
    if (this.phase === 'matchEnd') return;
    this.timeRemaining -= dt;
    if (this.phase === 'warmup' && this.timeRemaining <= 0) {
      this.phase = 'playing';
      this.timeRemaining = this.options.matchSeconds;
      this.onPhaseChange('playing', null);
    } else if (this.phase === 'playing' && this.timeRemaining <= 0) {
      this.endMatch();
    }
  }

  private endMatch(): void {
    this.phase = 'matchEnd';
    this.winner = this.alphaScore > this.bravoScore ? 'alpha' : this.bravoScore > this.alphaScore ? 'bravo' : null;
    for (const [id, prog] of this.progression) {
      prog.matchesPlayed++;
      if (this.winner === 'alpha' || this.winner === 'bravo') {
        prog.wins++;
        addXp(prog, XP_PER_WIN);
      }
      addXp(prog, XP_PER_MATCH);
      this.progression.set(id, prog);
    }
    this.onPhaseChange('matchEnd', this.winner);
  }
}

export function selectSpawnPoint(
  points: { x: number; z: number }[],
  awayFrom: { x: number; z: number },
  rng: () => number = Math.random,
): { x: number; z: number } {
  if (points.length === 0) return { x: 0, z: 0 };
  let best = points[0];
  let bestDist = -1;
  for (const p of points) {
    const dist = Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z);
    if (dist > bestDist) {
      bestDist = dist;
      best = p;
    }
  }
  const candidates = points.filter(
    (p) => Math.hypot(p.x - awayFrom.x, p.z - awayFrom.z) >= bestDist - 1e-6,
  );
  const pick = rng();
  return candidates[Math.min(candidates.length - 1, Math.floor(pick * candidates.length))] ?? best;
}
