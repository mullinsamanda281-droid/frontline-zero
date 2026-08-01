import { describe, expect, it } from 'vitest';
import { Vec3 } from '../camera/vec3';
import { Bot } from './bot';
import { BotManager } from './botManager';

function context(playerPosition: Vec3, lineOfSight: boolean, damageLog: number[] = []) {
  return {
    playerPosition,
    lineOfSight,
    shootPlayer(damage: number) {
      damageLog.push(damage);
    },
  };
}

describe('Bot', () => {
  it('patrols waypoints when player is out of vision', () => {
    const bot = new Bot({
      waypoints: [new Vec3(0, 0, 0), new Vec3(10, 0, 0)],
      visionRange: 5,
    });
    const player = new Vec3(50, 0, 50);
    const ctx = context(player, false);
    for (let i = 0; i < 120; i++) {
      bot.update(1 / 60, ctx);
    }
    expect(bot.state).toBe('patrol');
    expect(bot.position.x).toBeGreaterThan(0);
  });

  it('engages when player is in line of sight and within vision range', () => {
    const bot = new Bot({
      waypoints: [new Vec3(0, 0, 0), new Vec3(10, 0, 0)],
      visionRange: 60,
    });
    const ctx = context(new Vec3(20, 0, 0), true);
    bot.update(1 / 60, ctx);
    expect(bot.state).toBe('engage');
  });

  it('shoots the player while engaging with line of sight', () => {
    const bot = new Bot({
      waypoints: [new Vec3(0, 0, 0)],
      visionRange: 60,
      accuracy: 0,
    });
    const damageLog: number[] = [];
    const ctx = context(new Vec3(20, 0, 0), true, damageLog);
    for (let i = 0; i < 60; i++) {
      bot.update(1 / 60, ctx);
    }
    expect(damageLog.length).toBeGreaterThan(0);
    expect(damageLog[0]).toBe(12);
  });

  it('does not shoot without line of sight', () => {
    const bot = new Bot({
      waypoints: [new Vec3(0, 0, 0)],
      visionRange: 60,
    });
    const damageLog: number[] = [];
    const ctx = context(new Vec3(10, 0, 0), false, damageLog);
    for (let i = 0; i < 60; i++) {
      bot.update(1 / 60, ctx);
    }
    expect(damageLog.length).toBe(0);
  });

  it('retreats when health drops below retreat threshold', () => {
    const bot = new Bot({
      waypoints: [new Vec3(0, 0, 0)],
      visionRange: 60,
      retreatHealth: 30,
    });
    bot.health = 20;
    bot.update(1 / 60, context(new Vec3(10, 0, 0), true));
    bot.update(1 / 60, context(new Vec3(10, 0, 0), true));
    expect(bot.state).toBe('retreat');
  });

  it('dies and starts a respawn timer at zero health', () => {
    const bot = new Bot({ waypoints: [new Vec3(0, 0, 0)] });
    bot.takeDamage(100);
    expect(bot.alive).toBe(false);
    expect(bot.respawnTimer).toBe(3);
    const damageLog: number[] = [];
    bot.update(1 / 60, context(new Vec3(10, 0, 0), true, damageLog));
    expect(damageLog.length).toBe(0);
  });

  it('difficulty tunes hit probability', () => {
    const value = 0.09;
    const easy = new Bot({ accuracy: 0.12, waypoints: [new Vec3(0, 0, 0)] }, () => value);
    const hard = new Bot({ accuracy: 0.02, waypoints: [new Vec3(0, 0, 0)] }, () => value);
    const easyLog: number[] = [];
    const hardLog: number[] = [];
    for (let i = 0; i < 20; i++) {
      easy.update(1 / 60, context(new Vec3(20, 0, 0), true, easyLog));
      hard.update(1 / 60, context(new Vec3(20, 0, 0), true, hardLog));
    }
    expect(hardLog.length).toBeGreaterThan(0);
    expect(easyLog.length).toBe(0);
    expect(hardLog.length).toBeGreaterThan(easyLog.length);
  });
});

describe('BotManager', () => {
  it('fills the lobby with bots up to minPlayers', () => {
    const manager = new BotManager({ minPlayers: 4, humanCount: 1 });
    expect(manager.bots.length).toBe(3);
    expect(manager.neededBots).toBe(3);
  });

  it('retires the oldest bot when a human joins', () => {
    const manager = new BotManager({ minPlayers: 4, humanCount: 1 });
    manager.onHumanJoin();
    expect(manager.bots.length).toBe(2);
    expect(manager.neededBots).toBe(2);
  });

  it('refills when a human leaves', () => {
    const manager = new BotManager({ minPlayers: 4, humanCount: 2 });
    manager.onHumanLeave();
    expect(manager.bots.length).toBe(3);
  });
});
