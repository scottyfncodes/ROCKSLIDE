/**
 * Koda's bond with Vince: it grows with rescues, play and treats from the lodge, and opens Koda's
 * skills as it does. Pure.
 */

export interface Skill {
  id: 'nose' | 'range' | 'finder' | 'warning';
  name: string;
  /** bond (0..100) it opens at */
  at: number;
  blurb: string;
}

export const SKILLS: Skill[] = [
  { id: 'nose', name: 'Quick nose', at: 20, blurb: 'Tracks scent faster on a search' },
  { id: 'range', name: 'Long range', at: 40, blurb: 'Picks up scent from further away' },
  { id: 'finder', name: 'Finder', at: 60, blurb: 'Finds guests’ lost things' },
  { id: 'warning', name: 'Warning bark', at: 80, blurb: 'Barks before a slope lets go on its own' },
];

export const BOND = { pet: 1, play: 2, treat: 4, rescue: 8, petPerDay: 6 };
export const TREAT_COST = 5;

export const hasSkill = (bond: number, id: Skill['id']) => bond >= SKILLS.find((s) => s.id === id)!.at;

/** Add to the bond (capped at 100); returns any skills this opened. */
export function addBond(bond: number, amount: number): { bond: number; opened: Skill[] } {
  const next = Math.max(0, Math.min(100, bond + amount));
  return { bond: next, opened: SKILLS.filter((s) => bond < s.at && next >= s.at) };
}

/** How Koda searches a debris field: speed (m/s), scent radius (m), seconds to work a spot. */
export function searchStats(bond: number): { speed: number; radius: number; work: number } {
  return {
    speed: hasSkill(bond, 'nose') ? 5.2 : 3.8,
    radius: hasSkill(bond, 'range') ? 11 : 7,
    work: hasSkill(bond, 'nose') ? 1.2 : 2,
  };
}
