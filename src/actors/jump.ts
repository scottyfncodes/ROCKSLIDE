/**
 * The jump on skis: press JUMP and Vince sinks into a crouch, the longer the deeper; let go and he
 * springs up out of it. A tap is a small hop; a full crouch (about half a second) is enough air on the
 * flat for a grab, a flip or a 360.
 *
 * Off a kicker or a crest, it is the pop: release on the ramp or just as the snow falls away and the
 * spring adds to what the lip gives, for much bigger air. Released a beat too late (the skis already a
 * moment off the snow) and the crouch is wasted: timing is the skill.
 *
 * Pure: the game feeds it the button and the glider's air state, and adds the upward speed it returns.
 */

export const JUMP = {
  /** seconds of crouch to a full charge */
  chargeSecs: 0.45,
  /** upward speed (m/s) of a tap, and what a full crouch adds: 3 m/s is about 0.6 s of air on the flat, 5.6 about 1.15 s */
  pop: 3,
  charged: 2.6,
  /** after the skis leave the snow on their own, a release this soon (s) still pops... */
  late: 0.16,
  /** ...with this share of the spring (it is pushing off the lip, not off the flat) */
  lipKeep: 0.85,
  /** the crouch shows at once on the press, this deep, and deepens with the charge */
  crouchMin: 0.35,
};

export interface JumpState {
  /** the button was down last step */
  held: boolean;
  /** 0..1, how far into the crouch this press is (only while on the snow, or carried just over the lip) */
  charge: number;
  /** this time in the air already had its pop */
  popped: boolean;
  /** a press that began in the air after the late window: does nothing until it lets go */
  dead: boolean;
}

export interface JumpPop {
  /** upward speed to add (m/s) */
  vy: number;
  /** 0..1, how charged it was */
  charge: number;
  /** popped off a lip (released just after the snow fell away) rather than from the snow */
  lip: boolean;
}

export const newJump = (): JumpState => ({ held: false, charge: 0, popped: false, dead: false });

/** How deep the crouch is (0..1) for the pose: at once on the press, deeper as it charges. */
export const crouchOf = (j: JumpState): number => (j.held && !j.dead && j.charge > 0 ? JUMP.crouchMin + (1 - JUMP.crouchMin) * j.charge : 0);

/**
 * One step. `held`: the button is down. `airborne` and `airT` (seconds since the skis left the snow)
 * from the glider. `can`: in control (not recovering from a wipeout, not on a lift). Returns the pop on
 * the step it happens, else null.
 */
export function stepJump(j: JumpState, held: boolean, airborne: boolean, airT: number, dt: number, can = true): JumpPop | null {
  const pressed = held && !j.held;
  const released = !held && j.held;
  j.held = held;
  if (!airborne) j.popped = false;
  if (!can) {
    j.charge = 0;
    j.dead = held;
    return null;
  }
  if (pressed) {
    // a press in the air does nothing (past the lip's grace it is too late to pop)
    j.dead = airborne && (j.popped || airT > JUMP.late);
    j.charge = 0;
  }
  const inWindow = !airborne || (!j.popped && airT <= JUMP.late);
  if (held && !j.dead) {
    if (!airborne) j.charge = Math.min(1, j.charge + dt / JUMP.chargeSecs);
    // carried over the lip and held too long: the crouch is spent
    else if (!inWindow) {
      j.charge = 0;
      j.dead = true;
    }
    // the first step of a press counts: a tap is never zero
    if (j.charge === 0 && !j.dead && !airborne) j.charge = 1e-3;
    return null;
  }
  if (released) {
    const dead = j.dead;
    const c = j.charge;
    j.charge = 0;
    j.dead = false;
    if (dead || !inWindow) return null;
    const vy = JUMP.pop + JUMP.charged * c;
    j.popped = true;
    if (!airborne) return { vy, charge: c, lip: false };
    return { vy: vy * JUMP.lipKeep, charge: c, lip: true };
  }
  if (!held) j.dead = false;
  return null;
}
