import type { Difficulty } from '@reign/engine';
import type { GameResult } from './db';

/**
 * Lifetime recognition, computed from results already being recorded rather
 * than from any separate tally — so history is derived, never drifts out of
 * step, and survives whatever else changes. Kept deliberately quiet: a shelf of
 * small marks in the cabinet, not a scoreboard.
 */

export interface QuestSummary {
  id: string;
  levelCount: number;
  completed: number[];
  stars: Record<string, number>;
}

export interface Stats {
  solved: number;
  byDifficulty: Record<Difficulty, number>;
  hintFree: number;
  best: Partial<Record<Difficulty, number>>;
  currentStreak: number;
  longestStreak: number;
  daysPlayed: number;
  questLevels: number;
  stars: number;
  perfectLevels: number;
  questsCompleted: number;
}

const DIFFICULTIES: Difficulty[] = ['easy', 'medium', 'hard'];

/** Local calendar day, so a late-night session counts as the day it felt like. */
function dayKey(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
}

function dayNumber(ms: number): number {
  const d = new Date(ms);
  return Math.floor(new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() / 86400000);
}

export function computeStats(results: GameResult[], quests: QuestSummary[], now = Date.now()): Stats {
  const byDifficulty: Record<Difficulty, number> = { easy: 0, medium: 0, hard: 0 };
  const best: Partial<Record<Difficulty, number>> = {};
  let hintFree = 0;

  for (const r of results) {
    if (DIFFICULTIES.includes(r.difficulty)) byDifficulty[r.difficulty]++;
    if ((r.hintsUsed ?? 0) === 0) hintFree++;
    const current = best[r.difficulty];
    if (current === undefined || r.seconds < current) best[r.difficulty] = r.seconds;
  }

  const days = [...new Set(results.map((r) => dayNumber(r.finishedAt)))].sort((a, b) => a - b);
  let longestStreak = 0;
  let run = 0;
  for (let i = 0; i < days.length; i++) {
    run = i > 0 && days[i] === days[i - 1] + 1 ? run + 1 : 1;
    if (run > longestStreak) longestStreak = run;
  }

  // A streak survives today being unplayed; it breaks once yesterday is missed.
  let currentStreak = 0;
  const today = dayNumber(now);
  const played = new Set(days);
  if (played.has(today) || played.has(today - 1)) {
    let cursor = played.has(today) ? today : today - 1;
    while (played.has(cursor)) {
      currentStreak++;
      cursor--;
    }
  }

  let questLevels = 0;
  let stars = 0;
  let perfectLevels = 0;
  let questsCompleted = 0;
  for (const q of quests) {
    questLevels += q.completed.length;
    for (const value of Object.values(q.stars)) {
      stars += value;
      if (value === 3) perfectLevels++;
    }
    if (q.levelCount > 0 && q.completed.length >= q.levelCount) questsCompleted++;
  }

  return {
    solved: results.length,
    byDifficulty,
    hintFree,
    best,
    currentStreak,
    longestStreak,
    daysPlayed: new Set(results.map((r) => dayKey(r.finishedAt))).size,
    questLevels,
    stars,
    perfectLevels,
    questsCompleted,
  };
}

export interface Achievement {
  id: string;
  name: string;
  note: string;
  mark: string;
  earned: boolean;
  /** Shown for unearned marks so the next one is visible without nagging. */
  have?: number;
  need?: number;
}

interface Rule {
  id: string;
  name: string;
  note: string;
  mark: string;
  need?: number;
  value: (s: Stats) => number;
}

const RULES: Rule[] = [
  { id: 'first', name: 'First impression', note: 'Solve your first puzzle', mark: '♛', need: 1, value: (s) => s.solved },
  { id: 'ten', name: 'Steady hand', note: 'Solve ten puzzles', mark: '✒', need: 10, value: (s) => s.solved },
  { id: 'fifty', name: 'Well practised', note: 'Solve fifty puzzles', mark: '❦', need: 50, value: (s) => s.solved },
  { id: 'twohundred', name: 'Bound volume', note: 'Solve two hundred puzzles', mark: '▤', need: 200, value: (s) => s.solved },
  { id: 'hard-ten', name: 'Deep water', note: 'Solve ten hard puzzles', mark: '⌘', need: 10, value: (s) => s.byDifficulty.hard },
  { id: 'unaided', name: 'Unaided', note: 'Solve twenty puzzles without a hint', mark: '◈', need: 20, value: (s) => s.hintFree },
  { id: 'streak3', name: 'Three evenings', note: 'Play three days running', mark: '☾', need: 3, value: (s) => s.longestStreak },
  { id: 'streak7', name: 'A full week', note: 'Play seven days running', mark: '✧', need: 7, value: (s) => s.longestStreak },
  { id: 'streak30', name: 'A season of it', note: 'Play thirty days running', mark: '❈', need: 30, value: (s) => s.longestStreak },
  { id: 'stars25', name: 'Well starred', note: 'Earn twenty-five stars', mark: '★', need: 25, value: (s) => s.stars },
  { id: 'perfect10', name: 'Immaculate', note: 'Take three stars on ten levels', mark: '✦', need: 10, value: (s) => s.perfectLevels },
  { id: 'quest', name: 'Journey’s end', note: 'Complete a quest', mark: '⊛', need: 1, value: (s) => s.questsCompleted },
];

export function evaluate(stats: Stats): Achievement[] {
  return RULES.map((rule) => {
    const have = rule.value(stats);
    const need = rule.need ?? 1;
    return {
      id: rule.id,
      name: rule.name,
      note: rule.note,
      mark: rule.mark,
      earned: have >= need,
      have,
      need,
    };
  });
}

export function formatTime(seconds: number): string {
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}
