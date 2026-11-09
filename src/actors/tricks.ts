/**
 * Tricks on skis: everything happens in the air, from a kicker or any crest that throws you.
 *
 * - Tap TRICK: a grab (named by the stick: no direction a mute, left/right a safety or a tail).
 * - Hold TRICK: a spin, the way the stick leans (right by default). Let go and it finishes the turn it
 *   is on, so you commit to a 360 or a 720 by when you let go. With the stick on a diagonal the spin goes
 *   off axis: back and to a side a Cork, forward and to a side a Misty (more points; the body tips nearly
 *   flat through it and has to come back upright before the snow, or it is a stumble).
 * - Tap with the stick on a diagonal: a Japan (forward) or a Blunt (back) grab.
 * - Stick forward or back with TRICK: a front or back flip, finished the same way.
 * - Everything in one jump chains into a combo: each trick multiplies the jump's score.
 * - On the snow, TRICK with the stick forward or back is a butter: a nose or a tail press, held for at
 *   least half a second, scored when it ends (the longer, the more, up to two seconds' worth). With the
 *   stick to a side it is a butter spin, round on the tips: Butter 360, 720 (let go and it finishes the
 *   turn it is on; pop off the snow in the middle of one and it carries on in the air).
 * - The landing names the jump the way skiers do: the rotations, then the grabs (Cork 720 Mute).
 *
 * The landing grades it: within 40 degrees of a finished rotation is clean (points, a speed boost and
 * style), up to 100 a stumble (no points, a short wobble), past that a wipeout (a tumble you are up from
 * in about a second). A style meter fills with tricks and clean, fast lines, drains slowly, and when it
 * is full it pays out a few seconds of double score and a little extra speed.
 *
 * Pure: the game feeds it the glider's air state and the button; it never touches the scene.
 */

export type TrickKind = 'grab' | 'spin' | 'flip' | 'butter';
/** a spin about the vertical, or off axis: a Cork (tipped back and over) or a Misty (tipped forward) */
export type SpinAxis = 'flat' | 'cork' | 'misty';

export interface Trick {
  kind: TrickKind;
  name: string;
  points: number;
}

export interface TrickInput {
  /** the trick button is down this step */
  held: boolean;
  /** stick: x right, y forward (-1..1) */
  sx: number;
  sy: number;
}

export type Landing = 'clean' | 'stumble' | 'wipeout';

export interface TrickEvent {
  type: 'start' | 'trick' | 'land' | 'styleFull' | 'butter';
  trick?: Trick;
  landing?: Landing;
  /** the jump's name, the way a skier would say it (on 'land') */
  name?: string;
  /** points the jump scored (after the combo and the style multiplier); 0 unless clean */
  points?: number;
  combo?: number;
  /** degrees off a finished rotation at touchdown */
  off?: number;
  /** the speed boost a clean landing gives (m/s) */
  boost?: number;
}

export interface TrickState {
  /** in the air this step */
  air: boolean;
  /** seconds since take-off */
  airT: number;
  /** spin about the vertical (rad, signed: + is to the right) and its rate */
  spin: number;
  spinRate: number;
  /** flip about the skier's own side axis (rad, + front) and its rate */
  flip: number;
  flipRate: number;
  /** a grab is on (seconds left) and which */
  grabT: number;
  grabName: string;
  /** how long the button has been held this press, and whether this press already started something */
  pressT: number;
  pressUsed: boolean;
  wasHeld: boolean;
  /** what is rotating to completion after the button was let go */
  finishing: boolean;
  /** this jump's tricks */
  tricks: Trick[];
  /** completed full turns already counted (spin, flip) */
  spinsCounted: number;
  flipsCounted: number;
  /** 0..1 */
  style: number;
  /** seconds the full-meter payout has left */
  hotT: number;
  /** seconds of wobble or tumble left after a bad landing */
  recoverT: number;
  /** what the last landing was (for the pose) */
  last: Landing | null;
  /** on the snow: the press, -1 (tail) .. 1 (nose), eased for the pose; the butter held and for how long */
  press: number;
  butterDir: number;
  butterT: number;
  /** this jump's spin axis, which way the last spin went (+1 right), and how far off true the body is (0..1) */
  axis: SpinAxis;
  spinDir: number;
  tilt: number;
  /** a butter spin is going round on the snow */
  groundSpin: boolean;
  /** the session's points and best combo */
  score: number;
  best: number;
}

export const TRICK = {
  /** a press longer than this is a hold (s) */
  holdAfter: 0.2,
  /** spin and flip rates (rad/s): a 360 takes about 0.62 s, a flip 0.8 s */
  spinRate: (Math.PI * 2) / 0.62,
  flipRate: (Math.PI * 2) / 0.8,
  grabSecs: 0.55,
  points: { grab: 100, spin: 250, flip: 400, air: 60, clean: 100 },
  /** degrees off a finished rotation: clean within, stumble up to, wipeout past */
  cleanDeg: 40,
  stumbleDeg: 100,
  /** style meter: per point scored, per second of a clean fast line, drained per second */
  stylePerPoint: 1 / 2400,
  styleLine: 0.025,
  styleDecay: 0.018,
  hotSecs: 8,
  hotScore: 2,
  hotPush: 1.6,
  /** recovery (s) */
  stumbleSecs: 0.55,
  wipeoutSecs: 1.1,
  /** a butter: at least this long (s) to count, its points per second held (up to 2 s), how fast the press goes on */
  butterMin: 0.5,
  butterPoints: 90,
  butterMaxSecs: 2,
  pressRate: 9,
  /** a Cork or a Misty: points per turn as a multiple of a flat spin's; how fast the body tips off axis (1/s) */
  offAxis: 1.5,
  tiltRate: 9,
  /** degrees a landing counts as off, per unit of tilt still left at touchdown */
  tiltDeg: 75,
  /** a butter spin on the snow: a turn takes this long (s), and its points per turn */
  butterSpinSecs: 0.95,
  butterSpinPoints: 160,
  /** the stick counts as on a diagonal when both its axes are past this */
  diag: 0.35,
  /** a clean landing's push (m/s), more for a bigger combo */
  boost: [2.2, 3, 3.8, 4.4],
};

export const newTricks = (): TrickState => ({
  air: false,
  airT: 0,
  spin: 0,
  spinRate: 0,
  flip: 0,
  flipRate: 0,
  grabT: 0,
  grabName: '',
  pressT: 0,
  pressUsed: false,
  wasHeld: false,
  finishing: false,
  tricks: [],
  spinsCounted: 0,
  flipsCounted: 0,
  style: 0,
  hotT: 0,
  recoverT: 0,
  last: null,
  press: 0,
  axis: 'flat',
  spinDir: 1,
  tilt: 0,
  groundSpin: false,
  butterDir: 0,
  butterT: 0,
  score: 0,
  best: 0,
});

const TAU = Math.PI * 2;

/** Degrees between an angle and the nearest whole turn. */
export function offTurn(a: number): number {
  const r = ((Math.abs(a) % TAU) + TAU) % TAU;
  return (Math.min(r, TAU - r) * 180) / Math.PI;
}

/** The spin's name from its whole turns and its axis: 360, 720, Cork 720, Misty 1080. */
export const spinName = (turns: number, axis: SpinAxis = 'flat') => `${axis === 'cork' ? 'Cork ' : axis === 'misty' ? 'Misty ' : ''}${turns * 360}`;

const isDiag = (sx: number, sy: number) => Math.abs(sx) > TRICK.diag && Math.abs(sy) > TRICK.diag;

export function grabName(sx: number, sy = 0): string {
  if (isDiag(sx, sy)) return sy > 0 ? 'Japan grab' : 'Blunt grab';
  if (sx < -0.4) return 'Safety grab';
  if (sx > 0.4) return 'Tail grab';
  return 'Mute grab';
}

/** Points for a set of tricks in one jump: their sum, times the combo (one per trick), plus the air. */
export function jumpScore(tricks: readonly Trick[], airSecs: number, hot: boolean): number {
  if (!tricks.length) return 0;
  const sum = tricks.reduce((a, t) => a + t.points, 0);
  const base = sum * tricks.length + Math.round(airSecs * TRICK.points.air) + TRICK.points.clean;
  return Math.round(base * (hot ? TRICK.hotScore : 1));
}

/**
 * A jump's name, the way a skier says it: the rotations, then the grabs ("Cork 720 Mute", "Back flip
 * Safety", "Mute to Tail grab"). Empty for a jump with no tricks.
 */
export function jumpName(tricks: readonly Trick[]): string {
  const rot = tricks.filter((t) => t.kind === 'flip' || t.kind === 'spin').map((t) => t.name);
  const grabs = tricks.filter((t) => t.kind === 'grab').map((t) => t.name.replace(/ grab$/, ''));
  const g = grabs.filter((x, i) => grabs.indexOf(x) === i).join(' to ');
  if (!rot.length) return g ? `${g} grab` : '';
  return [...rot, g].filter(Boolean).join(' ');
}

/** How a landing went, from how far off a finished rotation the spin and the flip are (and how far off axis the body still is). */
export function grade(spin: number, flip: number, tilt = 0): { landing: Landing; off: number } {
  const off = Math.max(offTurn(spin), offTurn(flip) * 1.25) + tilt * TRICK.tiltDeg;
  return { landing: off <= TRICK.cleanDeg ? 'clean' : off <= TRICK.stumbleDeg ? 'stumble' : 'wipeout', off };
}

/**
 * One step. `airborne`: the glider is in the air. `landedHard`: the touchdown's speed into the slope
 * (m/s) on the step it lands. `fastLine`: on the snow at speed and in control (feeds the meter).
 */
export function stepTricks(s: TrickState, input: TrickInput, airborne: boolean, dt: number, fastLine = false, rolling = true): TrickEvent[] {
  const ev: TrickEvent[] = [];
  // a butter on the snow: the press follows the stick while TRICK is held; it ends (and scores) when it
  // lets go, changes ends, stops rolling or leaves the snow
  const want = !airborne && rolling && input.held && s.recoverT <= 0 ? (input.sy > 0.5 ? 1 : input.sy < -0.5 ? -1 : 0) : 0;
  // (a butter spin goes round up on the tips, so the press shows through it)
  s.press += ((want || (s.groundSpin ? 0.55 : 0)) - s.press) * Math.min(1, dt * TRICK.pressRate);
  if (want !== s.butterDir) {
    if (s.butterDir && s.butterT >= TRICK.butterMin) {
      const secs = Math.min(TRICK.butterMaxSecs, s.butterT);
      const t: Trick = { kind: 'butter', name: s.butterDir > 0 ? 'Nose butter' : 'Tail butter', points: Math.round(TRICK.butterPoints * secs * (s.hotT > 0 ? TRICK.hotScore : 1)) };
      s.score += t.points;
      s.style = Math.min(1, s.style + t.points * TRICK.stylePerPoint);
      ev.push({ type: 'butter', trick: t, points: t.points });
    }
    s.butterDir = want;
    s.butterT = 0;
  }
  if (want) s.butterT += dt;
  s.hotT = Math.max(0, s.hotT - dt);
  s.recoverT = Math.max(0, s.recoverT - dt);
  const pressed = input.held && !s.wasHeld;
  const released = !input.held && s.wasHeld;
  s.wasHeld = input.held;
  if (pressed) {
    s.pressT = 0;
    s.pressUsed = false;
  }
  if (input.held) s.pressT += dt;

  if (airborne) {
    if (!s.air) {
      s.air = true;
      s.airT = 0;
      s.tricks = [];
      // a butter spin popped off the snow carries on round in the air (its turns were scored on the snow)
      const carry = s.groundSpin;
      s.groundSpin = false;
      s.flip = s.flipRate = 0;
      s.flipsCounted = 0;
      if (!carry) {
        s.spin = s.spinRate = 0;
        s.spinsCounted = 0;
        s.axis = 'flat';
      }
      s.finishing = carry && !input.held;
      s.grabT = 0;
      // a press carried over from the ground does not count: press it in the air
      s.pressUsed = input.held;
    }
    s.airT += dt;
    const diag = isDiag(input.sx, input.sy);
    // straight forward or back is a flip; a diagonal waits to see whether it is a tap (a grab) or a hold (an off-axis spin)
    const flipDir = diag ? 0 : input.sy > 0.5 ? 1 : input.sy < -0.5 ? -1 : 0;
    // a press with the stick forward or back: a flip, from the moment it is pressed
    if (input.held && !s.pressUsed && flipDir && !s.flipRate) {
      s.flipRate = flipDir * TRICK.flipRate;
      s.pressUsed = true;
      s.finishing = false;
      ev.push({ type: 'start' });
    }
    // held past the tap: a spin
    if (input.held && !s.pressUsed && s.pressT >= TRICK.holdAfter && !s.spinRate) {
      s.spinDir = input.sx < -0.3 ? -1 : 1;
      s.spinRate = s.spinDir * TRICK.spinRate;
      s.axis = diag ? (input.sy > 0 ? 'misty' : 'cork') : 'flat';
      s.pressUsed = true;
      s.finishing = false;
      ev.push({ type: 'start' });
    }
    // a tap: a grab
    if (released && !s.pressUsed && s.pressT < TRICK.holdAfter) {
      s.grabT = TRICK.grabSecs;
      s.grabName = grabName(input.sx, input.sy);
      s.pressUsed = true;
      ev.push({ type: 'start' });
      const t: Trick = { kind: 'grab', name: s.grabName, points: TRICK.points.grab };
      s.tricks.push(t);
      ev.push({ type: 'trick', trick: t });
    }
    if (released && (s.spinRate || s.flipRate)) s.finishing = true;
    s.grabT = Math.max(0, s.grabT - dt);
    s.spin += s.spinRate * dt;
    s.flip += s.flipRate * dt;
    // whole turns count as they come round
    const spins = Math.floor(Math.abs(s.spin) / TAU + 1e-6);
    if (spins > s.spinsCounted) {
      s.spinsCounted = spins;
      // a bigger spin replaces the smaller one in the combo
      s.tricks = s.tricks.filter((t) => t.kind !== 'spin');
      const t: Trick = { kind: 'spin', name: spinName(spins, s.axis), points: Math.round(TRICK.points.spin * spins * (s.axis === 'flat' ? 1 : TRICK.offAxis)) };
      s.tricks.push(t);
      ev.push({ type: 'trick', trick: t });
      // finished: it stops on the whole turn
      if (s.finishing || !input.held) {
        s.spin = Math.sign(s.spin) * spins * TAU;
        s.spinRate = 0;
      }
    }
    const flips = Math.floor(Math.abs(s.flip) / TAU + 1e-6);
    if (flips > s.flipsCounted) {
      s.flipsCounted = flips;
      const t: Trick = { kind: 'flip', name: `${flips > 1 ? 'Double ' : ''}${s.flip > 0 ? 'front' : 'back'} flip`, points: TRICK.points.flip * flips };
      s.tricks = s.tricks.filter((x) => x.kind !== 'flip');
      s.tricks.push(t);
      ev.push({ type: 'trick', trick: t });
      if (s.finishing || !input.held) {
        s.flip = Math.sign(s.flip) * flips * TAU;
        s.flipRate = 0;
      }
    }
    if (!s.spinRate && !s.flipRate) s.finishing = false;
    // off axis while an off-axis spin goes round; back upright once it stops
    s.tilt += ((s.spinRate && s.axis !== 'flat' ? 1 : 0) - s.tilt) * Math.min(1, dt * TRICK.tiltRate);
    return ev;
  }

  // a butter spin: TRICK held with the stick to a side, round on the tips; let go and it finishes the turn
  if (!s.air) {
    const side = rolling && input.held && s.recoverT <= 0 && Math.abs(input.sx) > 0.5 && Math.abs(input.sy) < TRICK.diag;
    if (side && !s.groundSpin) {
      s.groundSpin = true;
      s.spinDir = Math.sign(input.sx);
      s.spinRate = (s.spinDir * TAU) / TRICK.butterSpinSecs;
      s.spin = 0;
      s.spinsCounted = 0;
      s.axis = 'flat';
      s.finishing = false;
      ev.push({ type: 'start' });
    }
    if (s.groundSpin) {
      if (!input.held) s.finishing = true;
      s.spin += s.spinRate * dt;
      const turns = Math.floor(Math.abs(s.spin) / TAU + 1e-6);
      if (turns > s.spinsCounted) {
        s.spinsCounted = turns;
        const t: Trick = { kind: 'butter', name: `Butter ${turns * 360}`, points: Math.round(TRICK.butterSpinPoints * turns * (s.hotT > 0 ? TRICK.hotScore : 1)) };
        // a bigger one replaces the smaller: pay the difference
        const paid = turns > 1 ? Math.round(TRICK.butterSpinPoints * (turns - 1) * (s.hotT > 0 ? TRICK.hotScore : 1)) : 0;
        s.score += t.points - paid;
        s.style = Math.min(1, s.style + (t.points - paid) * TRICK.stylePerPoint);
        ev.push({ type: 'butter', trick: t, points: t.points });
        if (s.finishing) {
          s.groundSpin = false;
          s.spin = s.spinRate = 0;
          s.spinsCounted = 0;
        }
      }
    }
  }

  if (fastLine && s.recoverT <= 0) s.style = Math.min(1, s.style + TRICK.styleLine * dt);
  else s.style = Math.max(0, s.style - TRICK.styleDecay * dt);
  if (s.air) {
    // touchdown
    s.air = false;
    const g = grade(s.spin, s.flip, s.tilt);
    s.last = g.landing;
    let points = 0;
    let boost = 0;
    const combo = s.tricks.length;
    if (g.landing === 'clean') {
      points = jumpScore(s.tricks, s.airT, s.hotT > 0);
      if (combo) boost = TRICK.boost[Math.min(TRICK.boost.length - 1, combo - 1)];
      s.score += points;
      s.best = Math.max(s.best, points);
      s.style = Math.min(1, s.style + points * TRICK.stylePerPoint);
    } else {
      s.recoverT = g.landing === 'stumble' ? TRICK.stumbleSecs : TRICK.wipeoutSecs;
      s.style = Math.max(0, s.style - (g.landing === 'wipeout' ? 0.35 : 0.15));
    }
    ev.push({ type: 'land', landing: g.landing, points, combo, off: g.off, boost, name: jumpName(s.tricks) });
    s.spin = s.flip = s.spinRate = s.flipRate = 0;
    s.tilt = 0;
    s.axis = 'flat';
    s.grabT = 0;
    s.tricks = [];
  }
  if (s.style >= 1 && s.hotT <= 0) {
    s.hotT = TRICK.hotSecs;
    s.style = 0;
    ev.push({ type: 'styleFull' });
  }
  return ev;
}
