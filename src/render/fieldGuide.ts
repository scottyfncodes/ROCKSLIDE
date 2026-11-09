/**
 * Art Direction 2.0, "Field Guide Alpine": cold world, warm people.
 *
 * The world-light values of Phase A in one place, so the art bible can quote them
 * (art/bible/tokens.ts) and tests/art-direction.test.ts can hold the two together.
 * - the surround is planned as three ridge bands, each with its own silhouette and its own step of haze
 *   (a field-guide plate: atmosphere separates the planes, not texture);
 * - snow is never white: lit snow leans cream, snow in shade leans cobalt-violet, dusk is peach over
 *   lilac, and moonlit snow is a readable blue;
 * - at night the people keep a cold moon fill and a sky rim, so they read against the snow without the
 *   night getting any brighter; the warmth comes only from what people made (windows, the headlamp).
 */

export interface Band {
  name: string;
  /** distance of the crest beyond the valley's edge (m) */
  d: number;
  /** half-width of the ridge across its crest (m) */
  w: number;
  /** crest height above the valley's foot (m): [low, high] before the north lift */
  crest: [number, number];
  /** extra height behind Kessel Bowl, to the north (m) */
  north: number;
  /** how far the band is lifted toward the haze, before distance fog */
  haze: number;
}

export const RANGE_BANDS: Band[] = [
  // rounded, timbered foothills: dark spruce, snowy glades
  { name: 'foothills', d: 640, w: 560, crest: [150, 290], north: 260, haze: 0.0 },
  // the range proper: serrated granite ridges, snow in the bowls
  { name: 'range', d: 1750, w: 780, crest: [380, 660], north: 430, haze: 0.16 },
  // the big summits: a skyline of separate peaks, palest of all
  { name: 'peaks', d: 3300, w: 1150, crest: [720, 1700], north: 760, haze: 0.4 },
];

/** Multipliers on the light that falls on snow (linear rgb): [lit, shade]. */
export const SNOW_LIGHT = {
  day: { lit: [1.05, 1.0, 0.92], shade: [0.8, 0.9, 1.2] },
  golden: { lit: [1.16, 0.93, 0.8], shade: [0.9, 0.82, 1.14] },
  night: { lit: [0.86, 0.95, 1.18], shade: [0.78, 0.88, 1.24] },
  /** how much darker the shaded snow sits against the lit (indirect light is scaled by this) */
  shadeDepth: 0.86,
};

/** The night: a moon that lets you see the snow, and the floor that keeps the people readable. */
export const NIGHT = {
  /** moonlight colour and intensity (replaces the old dim violet sun at night) */
  moon: 0x9fb4e8,
  moonIntensity: 0.62,
  /** skylight at night */
  sky: 0x2a3a66,
  ground: 0x26304e,
  skyIntensity: 0.5,
  /** a cold fill on the people and Koda (linear, added to their albedo) and their sky rim */
  figureFill: [0.06, 0.075, 0.12],
  figureRim: [0.16, 0.22, 0.36],
};

/** Lamplight thrown onto the snow by lit windows and Vince's headlamp. */
export const LAMPLIGHT = {
  window: 0xffc488,
  headlamp: 0xfff0d2,
};
