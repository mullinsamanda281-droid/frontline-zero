import { Bot } from './bot';
import type { BotDifficulty } from './bot';

export interface BotManagerOptions {
  minPlayers: number;
  humanCount: number;
  difficulties?: BotDifficulty[];
}

export class BotManager {
  readonly bots: Bot[] = [];
  private readonly difficulties: BotDifficulty[];
  private readonly minPlayers: number;
  private humanCount: number;

  constructor(options: BotManagerOptions) {
    this.minPlayers = options.minPlayers;
    this.humanCount = options.humanCount;
    this.difficulties = options.difficulties ?? ['easy', 'medium', 'hard', 'easy'];
    this.refill();
  }

  get neededBots(): number {
    return Math.max(0, this.minPlayers - this.humanCount);
  }

  get activeBots(): Bot[] {
    return this.bots.filter((b) => b.alive);
  }

  refill(): void {
    while (this.bots.length < this.neededBots) {
      const difficulty = this.difficulties[this.bots.length % this.difficulties.length];
      this.bots.push(new Bot({ name: this.botName(this.bots.length + 1), difficulty }));
    }
  }

  onHumanJoin(): void {
    this.humanCount++;
    if (this.bots.length > this.neededBots) {
      const retire = this.bots.find((b) => b.alive) ?? this.bots[0];
      retire.alive = false;
      retire.respawnTimer = Number.POSITIVE_INFINITY;
      this.bots.splice(this.bots.indexOf(retire), 1);
    }
  }

  onHumanLeave(): void {
    this.humanCount = Math.max(0, this.humanCount - 1);
    this.refill();
  }

  private botName(index: number): string {
    const names = [
      'REAPER-1',
      'VIPER-3',
      'HAVOC-7',
      'WRATH-2',
      'FURY-4',
      'RAGE-9',
      'BLITZ-5',
      'OPS-6',
    ];
    return names[(index - 1) % names.length];
  }
}
