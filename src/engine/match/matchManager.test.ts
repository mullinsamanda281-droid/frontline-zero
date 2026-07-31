import { describe, expect, it } from 'vitest';
import { MatchManager, selectSpawnPoint } from './matchManager';

describe('MatchManager', () => {
  it('starts in warmup and transitions to playing', () => {
    const phases: string[] = [];
    const match = new MatchManager({ warmupSeconds: 2, matchSeconds: 30 }, (p) => phases.push(p));
    match.start();
    expect(match.phase).toBe('warmup');
    match.update(2);
    expect(match.phase).toBe('playing');
    expect(phases).toEqual(['warmup', 'playing']);
    expect(match.timeRemaining).toBe(30);
  });

  it('scores kills only during playing phase', () => {
    const match = new MatchManager({ warmupSeconds: 2, matchSeconds: 30, scoreLimit: 10 });
    match.start();
    match.kill('alpha', null, null);
    expect(match.alphaScore).toBe(0);
    match.update(2);
    match.kill('alpha', null, null);
    match.kill('bravo', null, null);
    expect(match.alphaScore).toBe(1);
    expect(match.bravoScore).toBe(1);
  });

  it('ends the match at the score limit with a winner', () => {
    const match = new MatchManager({ warmupSeconds: 0, matchSeconds: 300, scoreLimit: 3 });
    match.start();
    match.update(1);
    match.kill('alpha', null, null);
    match.kill('alpha', null, null);
    match.kill('alpha', null, null);
    expect(match.phase).toBe('matchEnd');
    expect(match.winner).toBe('alpha');
  });

  it('ends the match on timer expiry', () => {
    const match = new MatchManager({ warmupSeconds: 0, matchSeconds: 5, scoreLimit: 100 });
    match.start();
    match.update(1);
    match.update(5);
    expect(match.phase).toBe('matchEnd');
  });

  it('ties have no winner', () => {
    const match = new MatchManager({ warmupSeconds: 0, matchSeconds: 5, scoreLimit: 100 });
    match.start();
    match.update(1);
    match.kill('alpha', null, null);
    match.kill('bravo', null, null);
    match.update(5);
    expect(match.winner).toBeNull();
  });

  it('tracks per-player kills and deaths', () => {
    const match = new MatchManager({ warmupSeconds: 0, matchSeconds: 30 });
    match.start();
    match.joinPlayer('p1');
    match.joinPlayer('p2');
    match.update(1);
    match.kill('alpha', 'p1', 'p2');
    match.kill('alpha', 'p1', 'p2');
    expect(match.players.get('p1')).toEqual({ kills: 2, deaths: 0 });
    expect(match.players.get('p2')).toEqual({ kills: 0, deaths: 2 });
  });

  it('ignores kills after match end', () => {
    const match = new MatchManager({ warmupSeconds: 0, matchSeconds: 30, scoreLimit: 2 });
    match.start();
    match.update(1);
    match.kill('alpha', null, null);
    match.kill('alpha', null, null);
    const score = match.alphaScore;
    match.kill('alpha', null, null);
    expect(match.alphaScore).toBe(score);
  });
});

describe('selectSpawnPoint', () => {
  const points = [
    { x: 0, z: 0 },
    { x: 40, z: 0 },
    { x: 0, z: 40 },
    { x: -40, z: -40 },
  ];

  it('picks the farthest point from the player', () => {
    const spawn = selectSpawnPoint(points, { x: 0, z: 0 }, () => 0);
    expect(spawn).toEqual({ x: -40, z: -40 });
  });

  it('randomizes among equally farthest candidates', () => {
    const spawns = new Set<string>();
    for (let i = 0; i < 20; i++) {
      const spawn = selectSpawnPoint(points, { x: 0, z: 0 }, () => i % 10 / 10);
      spawns.add(JSON.stringify(spawn));
    }
    expect(spawns.size).toBeGreaterThan(1);
  });

  it('returns origin for an empty list', () => {
    expect(selectSpawnPoint([], { x: 5, z: 5 })).toEqual({ x: 0, z: 0 });
  });
});
