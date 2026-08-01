export type MatchPhase = 'warmup' | 'playing' | 'matchEnd';

export interface MatchOptions {
  warmupSeconds?: number;
  matchSeconds?: number;
  scoreLimit?: number;
}

interface ResolvedMatchOptions {
  warmupSeconds: number;
  matchSeconds: number;
  scoreLimit: number;
}

export interface PlayerStats {
  kills: number;
  deaths: number;
}

export class MatchManager {
  phase: MatchPhase = 'warmup';
  alphaScore = 0;
  bravoScore = 0;
  timeRemaining = 0;
  winner: 'alpha' | 'bravo' | null = null;
  readonly players = new Map<string, PlayerStats>();
  private readonly options: ResolvedMatchOptions;
  private onPhaseChange: (phase: MatchPhase, winner: 'alpha' | 'bravo' | null) => void;

  constructor(options: MatchOptions = {}, onPhaseChange: (phase: MatchPhase, winner: 'alpha' | 'bravo' | null) => void = () => {}) {
    this.options = {
      warmupSeconds: 10,
      matchSeconds: 300,
      scoreLimit: 50,
      ...options,
    };
    this.onPhaseChange = onPhaseChange;
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
    }
    if (victimId) {
      const stats = this.players.get(victimId);
      if (stats) stats.deaths++;
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
