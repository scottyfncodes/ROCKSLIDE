import { mulberry32 } from '../sim/noise';

/**
 * A patrol day, the core loop: the morning briefing (weather, danger, new snow), the avalanche
 * control route before the runs open, the runs open, radio calls through the day, then the
 * end-of-day report with stars, XP and reputation. About ten to fifteen minutes of play.
 *
 * The **Daily Storm** is one seeded patrol day per real calendar day (UTC), the same for every
 * player: the same weather, the same danger, the same snowpack and the same calls, in the same order.
 * Free play is always there too. Pure.
 */

export type DayKind = 'powder' | 'windslab' | 'bluebird' | 'whiteout' | 'night';

export const KIND_LABEL: Record<DayKind, string> = {
  powder: 'Powder day',
  windslab: 'Wind slab',
  bluebird: 'Bluebird',
  whiteout: 'Whiteout',
  night: 'Night ops',
};

export const KIND_BRIEF: Record<DayKind, string> = {
  powder: 'Deep new snow overnight: the sleds wallow, the slopes are touchy. Danger up a level.',
  windslab: 'A hard wind loaded the lee slopes in slabs. Two zones are heavily loaded.',
  bluebird: 'Clear and cold, light wind. Danger down a level; a good day to open early.',
  whiteout: 'Cloud on the snow and blowing spindrift. You will barely see your skis: Koda knows the way.',
  night: 'Night operations: calls come in after dark. Headlamps on.',
};

export type CallType = 'toboggan' | 'lostskier' | 'resupply' | 'hoist' | 'chairlift' | 'closerun' | 'poachers' | 'night' | 'lostdog' | 'race';

export const CALL_LABEL: Record<CallType, string> = {
  toboggan: 'Injured skier: toboggan haul',
  lostskier: 'Lost skier at dusk',
  resupply: 'Sled resupply to the ridge hut',
  hoist: 'Heli hoist off the cliff band',
  chairlift: 'Chairlift evacuation',
  closerun: 'Close a run: ropes and signs',
  poachers: 'Out-of-bounds poachers',
  night: 'Night rescue by headlamp',
  lostdog: 'Lost dog: Koda searches',
  race: 'Race course setup',
};

/** The rank each call needs (0: from the start). */
export const CALL_RANK: Record<CallType, number> = { toboggan: 0, closerun: 0, race: 0, resupply: 0, lostdog: 0, chairlift: 1, lostskier: 1, hoist: 2, poachers: 3, night: 3 };

export interface CallSpec {
  type: CallType;
  seed: number;
  /** seconds into the open-runs part of the day it comes in */
  at: number;
}

export interface DayPlan {
  seed: number;
  kind: DayKind;
  danger: 1 | 2 | 3 | 4 | 5;
  /** new snow overnight (cm) */
  snow: number;
  calls: CallSpec[];
  daily: boolean;
  /** the date (yyyymmdd) for a Daily Storm */
  date: number | null;
}

/** A calendar date (UTC, so it is the same day everywhere at once) as a yyyymmdd number. */
export function dateSeed(d: Date): number {
  return d.getUTCFullYear() * 10000 + (d.getUTCMonth() + 1) * 100 + d.getUTCDate();
}

/** The yyyymmdd as "9 November 2026". */
export function dateLabel(seed: number): string {
  const y = Math.floor(seed / 10000);
  const m = Math.floor(seed / 100) % 100;
  const d = seed % 100;
  const M = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1];
  return `${d} ${M} ${y}`;
}

/** The previous calendar day's seed (for streaks). */
export function prevDate(seed: number): number {
  const y = Math.floor(seed / 10000);
  const m = Math.floor(seed / 100) % 100;
  const d = seed % 100;
  const t = Date.UTC(y, m - 1, d) - 86400000;
  return dateSeed(new Date(t));
}

const KINDS: DayKind[] = ['powder', 'windslab', 'bluebird', 'whiteout', 'night', 'bluebird', 'powder'];

/**
 * Plan a day. `rank` scales the calls (more, and harder ones become possible). A Daily Storm plans
 * with a fixed middle rank so every player gets the same day.
 */
export function planDay(seed: number, rank: number, daily = false): DayPlan {
  const rng = mulberry32(seed * 2654435761 + 977);
  const kind = KINDS[Math.floor(rng() * KINDS.length)];
  const base = 2 + Math.floor(rng() * 3);
  const danger = Math.max(1, Math.min(5, base + (kind === 'powder' || kind === 'windslab' ? 1 : 0) - (kind === 'bluebird' ? 1 : 0))) as DayPlan['danger'];
  const snow = kind === 'powder' ? 35 + Math.floor(rng() * 25) : kind === 'bluebird' ? Math.floor(rng() * 6) : 8 + Math.floor(rng() * 20);
  const r = daily ? 2 : rank;
  // the calls this rank can be sent on, weather allowing (no hoists in a whiteout: nobody flies)
  const pool = (Object.keys(CALL_RANK) as CallType[]).filter((t) => CALL_RANK[t] <= r && !(kind === 'whiteout' && t === 'hoist') && (t !== 'night' || kind === 'night'));
  const count = 4 + Math.min(2, Math.floor(r / 2)) + (danger >= 4 ? 1 : 0);
  const calls: CallSpec[] = [];
  let at = 20;
  let last: CallType | null = null;
  for (let i = 0; i < count; i++) {
    let t = pool[Math.floor(rng() * pool.length)];
    // variety: never the same call twice running
    if (t === last && pool.length > 1) t = pool[(pool.indexOf(t) + 1) % pool.length];
    last = t;
    calls.push({ type: t, seed: Math.floor(rng() * 1e6), at });
    at += 70 + Math.floor(rng() * 40);
  }
  return { seed, kind, danger, snow, calls, daily, date: daily ? seed : null };
}

/** The Daily Storm for a calendar day: one plan, the same for everyone. */
export const stormPlan = (date: number): DayPlan => planDay(date, 2, true);

export interface CallResult {
  type: CallType;
  stars: number;
  points: number;
  /** declined, or the day ended before it was done */
  skipped?: boolean;
}

export interface DayResult {
  control: number;
  calls: CallResult[];
  rescues: number;
  /** resort safety rating change today */
  safety: number;
  /** trick points scored today */
  style: number;
}

export interface DayReport {
  total: number;
  stars: number;
  xp: number;
  rep: number;
  lines: { label: string; points: number }[];
}

/** Score a day: control work, each call, rescues, a little style; three stars for a strong day. */
export function report(r: DayResult): DayReport {
  const lines = [
    { label: 'Avalanche control', points: Math.max(0, r.control) },
    ...r.calls.map((c) => ({ label: `${CALL_LABEL[c.type]}${c.skipped ? ' (missed)' : ` ${'★'.repeat(c.stars)}`}`, points: c.points })),
    { label: 'Rescues', points: r.rescues * 150 },
    { label: 'Style on skis', points: Math.min(500, Math.round(r.style / 10)) },
  ];
  const total = lines.reduce((a, l) => a + l.points, 0);
  const done = r.calls.filter((c) => !c.skipped);
  const avg = done.length ? done.reduce((a, c) => a + c.stars, 0) / Math.max(1, r.calls.length) : 0;
  const stars = total >= 2400 && avg >= 2.4 && r.control >= 300 ? 3 : total >= 1300 && avg >= 1.5 ? 2 : 1;
  return { total, stars, xp: Math.round(total / 2), rep: Math.round(total / 25) + r.safety, lines };
}

/** The shareable result: emoji stars and a few lines, no spoilers beyond the score. */
export function shareText(plan: DayPlan, rep: DayReport, streak: number): string {
  const s = '⭐'.repeat(rep.stars) + '☆'.repeat(3 - rep.stars);
  const calls = rep.lines.filter((l) => l.label !== 'Avalanche control' && l.label !== 'Rescues' && l.label !== 'Style on skis');
  const done = calls.filter((l) => !l.label.endsWith('(missed)')).length;
  return [
    `SNOW PATROL Daily Storm · ${plan.date ? dateLabel(plan.date) : ''}`,
    `${s} ${rep.total.toLocaleString('en-US')} pts`,
    `\u{1F3D4}️ ${KIND_LABEL[plan.kind]} · danger ${plan.danger}`,
    `\u{1F4FB} ${done}/${calls.length} calls · \u{1F415} Koda on duty`,
    `\u{1F525} streak ${streak}`,
    'rockslide-game.vercel.app',
  ].join('\n');
}

export interface Streak {
  /** last Daily Storm finished (yyyymmdd), 0: never */
  last: number;
  streak: number;
  best: number;
  /** each finished day's score */
  scores: Record<string, number>;
}

export const newStreak = (): Streak => ({ last: 0, streak: 0, best: 0, scores: {} });

/** Finish a Daily Storm: the streak runs on from yesterday, starts again after a gap; one score a day. */
export function finishStorm(s: Streak, date: number, score: number): Streak {
  if (s.last === date) {
    s.scores[date] = Math.max(s.scores[date] ?? 0, score);
    return s;
  }
  s.streak = s.last === prevDate(date) ? s.streak + 1 : 1;
  s.last = date;
  s.best = Math.max(s.best, s.streak);
  s.scores[date] = score;
  return s;
}

/** Where the day stands. */
export type DayPhase = 'briefing' | 'control' | 'calls' | 'report';

export interface DayState {
  plan: DayPlan;
  phase: DayPhase;
  /** seconds since the runs opened */
  t: number;
  /** next call to send */
  next: number;
  results: CallResult[];
  rescues: number;
  safety: number;
  styleAtStart: number;
}

export const newDayState = (plan: DayPlan, styleAtStart = 0): DayState => ({ plan, phase: 'briefing', t: 0, next: 0, results: [], rescues: 0, safety: 0, styleAtStart });

/**
 * Tick the open-runs part of the day: returns the call that comes in now, if one does. A call waits
 * while another is under way (no pile-up), and the day is done once every call is answered or missed.
 */
export function tickDay(d: DayState, dt: number, busy: boolean): CallSpec | null {
  if (d.phase !== 'calls') return null;
  d.t += dt;
  const c = d.plan.calls[d.next];
  if (!c || busy) return null;
  if (d.t >= c.at) {
    d.next++;
    // the clock never runs ahead of you: the next call is timed from this one
    if (d.next < d.plan.calls.length) {
      const gap = d.plan.calls[d.next].at - c.at;
      d.t = Math.min(d.t, c.at);
      d.plan.calls[d.next].at = d.t + gap;
    }
    return c;
  }
  return null;
}

export const dayDone = (d: DayState) => d.phase === 'calls' && d.next >= d.plan.calls.length;
