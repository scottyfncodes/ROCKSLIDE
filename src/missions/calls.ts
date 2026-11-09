import { mulberry32 } from '../sim/noise';
import { LIFT, pad, ROUTES, VILLAGE } from '../world/places';
import { SPOTS } from '../world/station';
import { registerMissions, type MissionDef, type Step, type Target } from './catalog';
import { CALL_LABEL, type CallType } from './patrolDay';
import { ZONES } from './control';

/**
 * The radio calls of a patrol day, generated from a type and a seed so that a call can be saved by
 * its id (`call:<type>:<seed>:<rank>`) and rebuilt exactly. They are ordinary missions: the step runner,
 * the HUD and the save all treat them like the story ones. Places come from the town and the mountain.
 */

const along = (id: string, k: number): Target => {
  const pts = ROUTES.find((r) => r.id === id)!.pts;
  const f = Math.max(0, Math.min(0.999, k)) * (pts.length - 1);
  const i = Math.floor(f);
  const u = f - i;
  return { x: pts[i][0] + (pts[i + 1][0] - pts[i][0]) * u, z: pts[i][1] + (pts[i + 1][1] - pts[i][1]) * u, label: '' };
};
const at = (t: Target, label: string): Target => ({ ...t, label });
const CLINIC = VILLAGE.find((v) => v.kind === 'clinic')!;
const CLINIC_T: Target = { x: CLINIC.x - 5, z: CLINIC.z, label: 'Hollin clinic' };
const PAD_T: Target = { x: SPOTS.heli.x, z: SPOTS.heli.z, label: 'Helipad' };

/** A scent trail from a start to an end, a point every 9 m, wandering a little. */
function trail(a: Target, b: Target, rng: () => number): { x: number; z: number }[] {
  const d = Math.hypot(b.x - a.x, b.z - a.z);
  const n = Math.max(3, Math.round(d / 9));
  const out: { x: number; z: number }[] = [];
  for (let i = 1; i <= n; i++) {
    const k = i / n;
    const w = Math.sin(k * Math.PI) * 6;
    out.push({ x: a.x + (b.x - a.x) * k + (rng() - 0.5) * w, z: a.z + (b.z - a.z) * k + (rng() - 0.5) * w });
  }
  return out;
}

/** Par time (seconds) for three stars. */
export const PAR: Record<CallType, number> = { toboggan: 170, lostskier: 200, resupply: 200, hoist: 160, chairlift: 150, closerun: 120, poachers: 260, night: 240, lostdog: 150, race: 140 };

export function callId(type: CallType, seed: number, rank: number): string {
  return `call:${type}:${seed}:${rank}`;
}

export function parseCall(id: string): { type: CallType; seed: number; rank: number } | null {
  const m = /^call:([a-z]+):(\d+):(\d+)$/.exec(id);
  if (!m || !(m[1] in CALL_LABEL)) return null;
  return { type: m[1] as CallType, seed: Number(m[2]), rank: Number(m[3]) };
}

/** Build a call's mission. Harder (more stops, further) with rank. */
export function buildCall(type: CallType, seed: number, rank: number): MissionDef {
  const rng = mulberry32(seed * 7 + 3);
  const id = callId(type, seed, rank);
  const pay = { funds: 70 + rank * 15, rep: 35 + rank * 10 };
  const base = { id, title: CALL_LABEL[type], reward: pay, requires: [] as string[], dynamic: true };
  let steps: Step[] = [];
  let family: MissionDef['family'] = 'rescue';
  let from = 'Dispatch';
  let brief = '';
  let alert = '';
  let done = '';
  let where: Target = { x: 470, z: 226, label: 'Lift Base Plaza' };
  let subject: MissionDef['subject'];
  switch (type) {
    case 'toboggan': {
      const p = at(along('piste', 0.25 + rng() * 0.45), 'Injured skier');
      subject = { kind: 'skier', x: p.x + 4, z: p.z, name: 'Injured skier' };
      where = p;
      from = 'Tannberg lifts';
      alert = 'Injured skier on the Tannberg run, can not ski down. Bring the toboggan.';
      brief = 'A knee on the Tannberg run. Ski to them, splint it, then ski the toboggan down to the clinic without dumping it: smooth turns, no air.';
      done = 'Clinic has them. Smooth run, patrol.';
      steps = [
        { kind: 'goto', at: p, radius: 10, text: 'Ski to the injured skier on the run', by: ['skis'] },
        { kind: 'interact', id: 'c-aid', at: { x: subject.x, z: subject.z, label: 'Injured skier' }, radius: 4, text: 'Splint the knee and load the toboggan', action: 'First aid', hold: 2.5 },
        { kind: 'tow', at: CLINIC_T, text: 'Ski the toboggan down to the clinic: smooth, no air' },
        { kind: 'interact', id: 'c-handover', at: CLINIC_T, radius: 6, text: 'Hand over at the clinic', action: 'Hand over', hold: 0.6 },
      ];
      break;
    }
    case 'lostskier': {
      family = 'rescue';
      const start: Target = { x: 600 + rng() * 10, z: -322, label: 'Last seen' };
      const end: Target = { x: 640 + (rng() - 0.5) * 30, z: -235 + (rng() - 0.5) * 30, label: 'Lost skier' };
      subject = { kind: 'skier', x: end.x, z: end.z, name: 'Lost skier' };
      where = start;
      from = 'Tannberg lifts';
      alert = 'A skier did not come down from the top station. Light is going.';
      brief = 'Last seen at the top station heading for the trees. Give Koda the scent, follow before it is dark, warm them up, bring them down.';
      done = 'Found and warm. Koda, you are a legend.';
      steps = [
        { kind: 'goto', at: start, radius: 20, text: 'Get to the top station' },
        { kind: 'track', start, trail: trail(start, end, rng), at: end, text: 'Give Koda the scent and follow him into the trees' },
        { kind: 'interact', id: 'c-aid', at: end, radius: 4, text: 'Warm them up and check them over', action: 'First aid', hold: 2.5, onFoot: true },
        { kind: 'goto', at: { x: 470, z: 226, label: 'Lift Base Plaza' }, radius: 25, text: 'Bring them down to the plaza' },
      ];
      break;
    }
    case 'resupply': {
      family = 'community';
      const hut = rng() < 0.5 ? pad('cabin') : pad('lifttop');
      const hutT: Target = { x: hut.x + 4, z: hut.z + 2, label: hut.id === 'cabin' ? 'Fernhut' : 'Top station hut' };
      where = hutT;
      from = hut.id === 'cabin' ? 'Fernhut warden' : 'Top station';
      alert = `${hutT.label} is out of gas and food. Can you run a load up?`;
      brief = `Load the supply crate at the garage onto the sled and run it up to ${hutT.label}.`;
      done = 'Stove is lit again. Thanks for the haul.';
      steps = [
        { kind: 'interact', id: 'crate', at: { x: SPOTS.crate.x, z: SPOTS.crate.z, label: 'Supply crate' }, text: 'Load the supply crate onto the sled rack', action: 'Load crate', hold: 1, onFoot: true },
        { kind: 'goto', at: hutT, radius: 14, text: `Sled the supplies to ${hutT.label}`, by: ['sled'] },
        { kind: 'interact', id: 'unload', at: hutT, radius: 6, text: 'Unload the crate', action: 'Unload', hold: 1, onFoot: true },
      ];
      break;
    }
    case 'hoist': {
      const spots: Target[] = [
        { x: 600, z: -380, label: 'Cliff band' },
        { x: 430, z: -360, label: 'West Face cliffs' },
        { x: 700, z: -60, label: 'Hornli rocks' },
      ];
      const c = spots[Math.floor(rng() * spots.length)];
      subject = { kind: 'skier', x: c.x, z: c.z, name: 'Cliffed-out skier' };
      where = c;
      from = 'Tannberg lifts';
      alert = 'A skier is cliffed out above a drop. Nobody can get to them on foot.';
      brief = 'Fly to the cliff band, hold a steady hover close over them (8 to 30 m) while the hoist goes down, then fly them to the pad.';
      done = 'Hoist went like clockwork. Nice flying.';
      steps = [
        { kind: 'mount', vehicle: 'heli', text: 'Get in the helicopter' },
        { kind: 'hover', at: c, secs: 5 + rank, text: 'Hover low and steady over them for the hoist' },
        { kind: 'land', at: PAD_T, text: 'Fly them to the helipad and land' },
      ];
      break;
    }
    case 'chairlift': {
      family = 'response';
      const n = 2 + Math.min(2, rank);
      from = 'Lift operations';
      alert = 'The chairlift has stopped with people on it. Rope evacuation, now.';
      brief = `The lift is down. Go tower to tower and lower the people off the chairs (${n} chairs).`;
      done = 'Everybody off and on the ground. Mechanics are on it.';
      where = { x: LIFT.from[0], z: LIFT.from[1], label: 'Chairlift' };
      steps = [];
      for (let i = 0; i < n; i++) {
        const k = 0.12 + (i + rng() * 0.6) * (0.7 / n);
        const x = LIFT.from[0] + (LIFT.to[0] - LIFT.from[0]) * k + 3;
        const z = LIFT.from[1] + (LIFT.to[1] - LIFT.from[1]) * k;
        steps.push({ kind: 'interact', id: `c-chair-${i}`, at: { x, z, label: `Chair ${i + 1}` }, radius: 5, text: `Lower the people off chair ${i + 1} of ${n}`, action: 'Rope evac', hold: 2.5, onFoot: true });
      }
      break;
    }
    case 'closerun': {
      family = 'response';
      const n = 3;
      from = 'Snow safety';
      alert = 'Close the upper Tannberg run: wind loading above it.';
      brief = 'Rope it off and sign it at the top, the middle and the cut-across.';
      done = 'Run closed and signed. Good.';
      where = at(along('piste', 0.2), 'Tannberg Run');
      steps = [];
      for (let i = 0; i < n; i++) {
        const p = along('piste', 0.12 + i * 0.16 + rng() * 0.05);
        steps.push({ kind: 'interact', id: `c-rope-${i}`, at: { x: p.x + 14, z: p.z, label: `Closure ${i + 1}` }, radius: 5, text: `Rope and sign closure ${i + 1} of ${n}`, action: i === 0 ? 'Rope off' : 'Set sign', hold: 1.5 });
      }
      break;
    }
    case 'poachers': {
      const z = ZONES.find((q) => q.id === 'Z2')!;
      const p: Target = { x: z.x + 30, z: z.z + 50, label: 'Poachers' };
      where = p;
      from = 'Top station';
      alert = 'Two skiers ducked the rope into the closed West Face.';
      brief = 'Get up there and turn them back before they trigger something.';
      done = 'Both alive. Their passes are on my desk.';
      steps = [
        { kind: 'goto', at: p, radius: 40, text: 'Get to the West Face, fast' },
        { kind: 'rescue', text: 'They triggered it: find them, probe, dig' },
      ];
      break;
    }
    case 'night': {
      const p = at(along('cabintrack', 0.3 + rng() * 0.5), 'Stranded walker');
      subject = { kind: 'skier', x: p.x + 3, z: p.z, name: 'Stranded walker' };
      where = p;
      from = 'Fernhut warden';
      alert = 'A walker turned an ankle on the Fernhut track after dark.';
      brief = 'Headlamp on. Take the sled up the Fernhut track, splint the ankle, bring them down to the clinic.';
      done = 'Home safe. Good night, patrol.';
      steps = [
        { kind: 'mount', vehicle: 'sled', text: 'Take the sled' },
        { kind: 'goto', at: p, radius: 14, text: 'Find them on the Fernhut track', by: ['sled'] },
        { kind: 'interact', id: 'c-aid', at: { x: subject.x, z: subject.z, label: 'Walker' }, radius: 4, text: 'Splint the ankle', action: 'First aid', hold: 2.5, onFoot: true },
        { kind: 'carry', text: 'Help them onto the sled' },
        { kind: 'goto', at: CLINIC_T, radius: 10, text: 'Bring them to the clinic', by: ['sled'] },
        { kind: 'interact', id: 'c-handover', at: CLINIC_T, radius: 6, text: 'Hand over at the clinic', action: 'Hand over', hold: 0.6, onFoot: true },
      ];
      break;
    }
    case 'lostdog': {
      family = 'community';
      const start: Target = { x: 472 + rng() * 6, z: 300 + rng() * 10, label: 'Collar on Main Street' };
      const end: Target = { x: 380 + rng() * 60, z: 200 + rng() * 40, label: 'Lost dog' };
      subject = { kind: 'cat', x: end.x, z: end.z, name: 'Biscuit' };
      where = start;
      from = 'A guest';
      alert = 'A guest’s dog slipped its collar on Main Street. He is somewhere up the hill.';
      brief = 'Let Koda smell the collar and follow him to the dog. Bring the dog home.';
      done = 'Biscuit is back. Koda gets a treat for that one.';
      steps = [
        { kind: 'track', start, trail: trail(start, end, rng), at: end, text: 'Give Koda the collar and follow him' },
        { kind: 'interact', id: 'c-dog', at: end, radius: 4, text: 'Coax the dog over', action: 'Call him', hold: 1.2, onFoot: true },
        { kind: 'goto', at: { x: 466, z: 300, label: 'Main Street' }, radius: 12, text: 'Walk him back to Main Street' },
      ];
      break;
    }
    case 'race': {
      family = 'community';
      const n = 3 + Math.min(2, rank);
      from = 'Tannberg race club';
      alert = 'Club race at noon and no course. Can you set the gates?';
      brief = `Set ${n} gates down the lower Tannberg run.`;
      done = 'Course looks great. Fastest time gets a coffee.';
      where = at(along('piste', 0.7), 'Race course');
      steps = [];
      for (let i = 0; i < n; i++) {
        const p = along('piste', 0.62 + (i / n) * 0.3);
        const side = i % 2 ? 1 : -1;
        steps.push({ kind: 'interact', id: `c-gate-${i}`, at: { x: p.x + side * 6, z: p.z, label: `Gate ${i + 1}` }, radius: 4, text: `Set gate ${i + 1} of ${n}`, action: 'Set gate', hold: 1 });
      }
      break;
    }
  }
  return { ...base, family, from, brief, alert, done, where, subject, steps };
}

/** Stars for a finished call: under par and clean is three; a dumped toboggan costs one each. */
export function callStars(type: CallType, seconds: number, dumps = 0): number {
  const par = PAR[type];
  const s = seconds <= par ? 3 : seconds <= par * 1.6 ? 2 : 1;
  return Math.max(1, s - dumps);
}

export const callPoints = (stars: number, rank: number) => 80 + stars * 110 + rank * 20;

// the catalog resolves call ids through this
registerMissions((id) => {
  const c = parseCall(id);
  return c ? buildCall(c.type, c.seed, c.rank) : undefined;
});
