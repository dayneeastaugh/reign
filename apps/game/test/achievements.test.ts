import { describe, it, expect } from 'vitest';
import { computeStats, evaluate, type QuestSummary } from '../src/achievements';
import type { GameResult } from '../src/db';

const DAY = 86400000;
const noon = (daysAgo: number, from = Date.UTC(2026, 7, 16, 12)) => from - daysAgo * DAY;

function result(over: Partial<GameResult> = {}): GameResult {
  return {
    puzzleId: 'easy-7-1',
    difficulty: 'easy',
    seconds: 100,
    hintsUsed: 0,
    finishedAt: noon(0),
    ...over,
  };
}

describe('lifetime stats', () => {
  it('counts solves, difficulties, hint-free runs and personal bests', () => {
    const stats = computeStats(
      [
        result({ difficulty: 'easy', seconds: 90 }),
        result({ difficulty: 'easy', seconds: 61 }),
        result({ difficulty: 'hard', seconds: 400, hintsUsed: 2 }),
        result({ difficulty: 'medium', seconds: 200 }),
      ],
      [],
    );
    expect(stats.solved).toBe(4);
    expect(stats.byDifficulty).toEqual({ easy: 2, medium: 1, hard: 1 });
    expect(stats.hintFree).toBe(3);
    expect(stats.best.easy).toBe(61);
    expect(stats.best.hard).toBe(400);
  });

  it('counts a streak of consecutive days, not of puzzles', () => {
    const now = noon(0);
    const stats = computeStats(
      [
        result({ finishedAt: noon(0) }),
        result({ finishedAt: noon(0) }),
        result({ finishedAt: noon(1) }),
        result({ finishedAt: noon(2) }),
        result({ finishedAt: noon(6) }),
      ],
      [],
      now,
    );
    expect(stats.currentStreak).toBe(3);
    expect(stats.longestStreak).toBe(3);
    expect(stats.daysPlayed).toBe(4);
  });

  it('keeps a streak alive on a day not yet played, and drops it after a gap', () => {
    const now = noon(0);
    const yesterdayOnly = computeStats([result({ finishedAt: noon(1) })], [], now);
    expect(yesterdayOnly.currentStreak).toBe(1);

    const stale = computeStats([result({ finishedAt: noon(3) })], [], now);
    expect(stale.currentStreak).toBe(0);
    expect(stale.longestStreak).toBe(1);
  });

  it('summarises quest progress across every quest held', () => {
    const quests: QuestSummary[] = [
      { id: 'a', levelCount: 3, completed: [0, 1, 2], stars: { 0: 3, 1: 2, 2: 3 } },
      { id: 'b', levelCount: 50, completed: [0, 1], stars: { 0: 1, 1: 3 } },
    ];
    const stats = computeStats([], quests);
    expect(stats.questLevels).toBe(5);
    expect(stats.stars).toBe(12);
    expect(stats.perfectLevels).toBe(3);
    expect(stats.questsCompleted).toBe(1);
  });

  it('handles a player who has never finished anything', () => {
    const stats = computeStats([], []);
    expect(stats.solved).toBe(0);
    expect(stats.currentStreak).toBe(0);
    expect(stats.best.easy).toBeUndefined();
    expect(evaluate(stats).every((a) => !a.earned)).toBe(true);
  });
});

describe('achievements', () => {
  it('earns marks as the thresholds are passed, and reports progress toward the rest', () => {
    const stats = computeStats(
      Array.from({ length: 12 }, (_, i) => result({ finishedAt: noon(i % 3) })),
      [],
    );
    const marks = evaluate(stats);
    const byId = Object.fromEntries(marks.map((m) => [m.id, m]));
    expect(byId.first.earned).toBe(true);
    expect(byId.ten.earned).toBe(true);
    expect(byId.fifty.earned).toBe(false);
    expect(byId.fifty.have).toBe(12);
    expect(byId.fifty.need).toBe(50);
    expect(byId.streak3.earned).toBe(true);
  });
});
