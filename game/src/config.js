// HELIODROME: Bend the Noon — shared constants, palettes and tuning.
//
// Everything the other modules agree on lives here: the logical field size,
// the spectrum colours and what each colour does to a shade creature, the
// tower catalogue's base prices, the enemy roster's base stats, and the
// per-island art direction (sky, ground, path and accent colours) that the
// renderer paints from. Numbers are tuned so a first-time player survives
// island one on mirrors alone and needs the full spectrum by island three.

/** Logical canvas size; the renderer scales this to the window. */
export const FIELD = { width: 1280, height: 800 };

/** The strip at the top of the field where the sky, sun and HUD live. */
export const SKY_HEIGHT = 118;

/** The strip at the bottom where the build bar and tower cards live. */
export const BAR_HEIGHT = 92;

/** Playable ground rectangle (between sky and bar). */
export const GROUND = {
  x: 24,
  y: SKY_HEIGHT + 10,
  width: FIELD.width - 48,
  height: FIELD.height - SKY_HEIGHT - BAR_HEIGHT - 20,
};

/** The beam may travel this far in total before it is spent. */
export const BEAM_MAX_LENGTH = 3400;

/** The beam may reflect or split at most this many times per trace. */
export const BEAM_MAX_EVENTS = 26;

/** Beam half-width in pixels: creatures within this of a segment are lit. */
export const BEAM_RADIUS = 15;

/** Fixed simulation step, seconds. The render loop accumulates real time. */
export const STEP = 1 / 60;

/** Waves in the campaign; endless mode continues past the last one. */
export const CAMPAIGN_WAVES = 40;

/** Every fifth wave is a night wave lit by the moonbeam instead. */
export const NIGHT_EVERY = 5;

/** A boss — an aspect of THE ECLIPSE — arrives every tenth wave. */
export const BOSS_EVERY = 10;

/**
 * The spectrum. Sunlight starts WHITE; a prism fans it into EMBER (burn),
 * GILDED (raw damage) and UMBRAL (slow). MOON is the night beam's colour:
 * pale, weak at burning, but its slow is deep and long.
 */
export const SPECTRUM = {
  white: { name: 'Sunlight', css: '#fff3c4', core: '#fffbe8', dps: 26, burn: 0, slow: 0, slowTime: 0 },
  ember: { name: 'Ember', css: '#ff7a3c', core: '#ffd9a0', dps: 9, burn: 16, slow: 0, slowTime: 0 },
  gilded: { name: 'Gilded', css: '#ffc93c', core: '#fff3b0', dps: 46, burn: 0, slow: 0, slowTime: 0 },
  umbral: { name: 'Umbral', css: '#9a6bff', core: '#e2d4ff', dps: 6, burn: 0, slow: 0.45, slowTime: 0.7 },
  moon: { name: 'Moonlight', css: '#bcd3ff', core: '#eef4ff', dps: 11, burn: 0, slow: 0.35, slowTime: 1.1 },
};

/** Tower catalogue: build cost, footprint radius and a one-line role. */
export const TOWERS = {
  mirror: { name: 'Mirror', cost: 40, radius: 17, key: '1', blurb: 'Bends the beam. Rotate it to steer the light.' },
  prism: { name: 'Prism', cost: 90, radius: 18, key: '2', blurb: 'Splits sunlight into Ember, Gilded and Umbral.' },
  lens: { name: 'Lens Focuser', cost: 110, radius: 18, key: '3', blurb: 'Focuses the beam: +80% damage, longer reach.' },
  splitter: { name: 'Splitter', cost: 130, radius: 18, key: '4', blurb: 'Forks the beam in two at half strength.' },
  bell: { name: 'Dawn Bell', cost: 150, radius: 19, key: '5', blurb: 'Rings at dawn: slows every shade on the field.' },
  shard: { name: 'Eclipse Shard', cost: 220, radius: 19, key: '6', blurb: 'Stores sunlight, then fires it as a piercing lance.' },
};

/** Sell price is this share of everything spent on the tower. */
export const SELL_SHARE = 0.7;

/** Upgrade cost multiplier per level already bought (levels 1..3). */
export const UPGRADE_COST = [70, 130, 240];

/** Each upgrade level multiplies the tower's beam effect by this. */
export const UPGRADE_POWER = 1.35;

/**
 * The shade roster. hp/speed are island-one values; waves scale them.
 * `leak` is the lives the Heart Crystal loses when the creature arrives.
 * `shadeHeal` is health regained per second while the creature is in shadow.
 */
export const ENEMIES = {
  moth: { name: 'Duskmoth', hp: 30, speed: 52, reward: 6, leak: 1, shadeHeal: 2, radius: 11 },
  crawler: { name: 'Gloomcrawler', hp: 85, speed: 34, reward: 9, leak: 1, shadeHeal: 4, radius: 14 },
  wraith: { name: 'Pale Wraith', hp: 55, speed: 74, reward: 11, leak: 1, shadeHeal: 3, radius: 12 },
  beetle: { name: 'Umbral Beetle', hp: 240, speed: 26, reward: 16, leak: 2, shadeHeal: 8, radius: 17 },
  swift: { name: 'Nightswift', hp: 42, speed: 118, reward: 12, leak: 1, shadeHeal: 2, radius: 10 },
  shade: { name: 'Greater Shade', hp: 420, speed: 40, reward: 24, leak: 2, shadeHeal: 10, radius: 19 },
  splitterbug: { name: 'Mitosis Husk', hp: 120, speed: 44, reward: 10, leak: 1, shadeHeal: 5, radius: 14 },
  veil: { name: 'Veilspinner', hp: 160, speed: 58, reward: 18, leak: 1, shadeHeal: 6, radius: 13 },
  colossus: { name: 'Gloom Colossus', hp: 1500, speed: 20, reward: 60, leak: 5, shadeHeal: 16, radius: 26 },
  eclipse: { name: 'THE ECLIPSE', hp: 5200, speed: 15, reward: 400, leak: 20, shadeHeal: 0, radius: 40 },
};

/** Starting resources on a fresh campaign. */
export const START = { gold: 190, lives: 20 };

/** Gold paid for clearing a wave, before interest and bonuses. */
export function waveClearGold(wave) {
  return 24 + Math.floor(wave * 1.6);
}

/** Interest on unspent gold at wave end, capped so hoarding has a ceiling. */
export function interestOn(gold) {
  return Math.min(24, Math.floor(gold * 0.06));
}

/** Enemy health multiplier for a wave number (campaign and endless alike). */
export function waveHpScale(wave) {
  return 1 + (wave - 1) * 0.16 + Math.pow(Math.max(0, wave - 20), 2) * 0.004;
}

/** Enemy speed multiplier: gentle, so fast builds stay readable. */
export function waveSpeedScale(wave) {
  return 1 + Math.min(0.35, (wave - 1) * 0.006);
}

/**
 * Art direction per island. The renderer lerps the sky by the sun's arc and
 * tints everything else from these anchors, so dawn coast, noon desert and
 * dusk cliffs each read as their own place at a glance.
 */
export const ISLAND_ART = [
  {
    name: 'Dawn Coast',
    skyTop: '#2e4a7d', skyMid: '#c96f4a', skyLow: '#f7c873',
    sea: '#274b63', ground: '#5d7a4a', groundDark: '#48603a', groundLight: '#74955c',
    path: '#3a3230', pathEdge: '#57493e', accent: '#ffd98a', rock: '#6b6f7a',
  },
  {
    name: 'Noon Desert',
    skyTop: '#3a6ea8', skyMid: '#7fb0d8', skyLow: '#ffe9a8',
    sea: '#c8a35a', ground: '#c9a45c', groundDark: '#a9853f', groundLight: '#e0bd76',
    path: '#5a4632', pathEdge: '#7a5f42', accent: '#fff0b0', rock: '#8a6f4d',
  },
  {
    name: 'Dusk Cliffs',
    skyTop: '#241f4e', skyMid: '#7a3a6e', skyLow: '#e88a5a',
    sea: '#2c2440', ground: '#4a4458', groundDark: '#383344', groundLight: '#5d5670',
    path: '#241f28', pathEdge: '#453a4e', accent: '#ffb37a', rock: '#55506b',
  },
];

/** Night art: the same island under the moon, cooled and darkened. */
export const NIGHT_ART = {
  skyTop: '#060a1e', skyMid: '#101c3f', skyLow: '#274069',
  ground: '#232c3d', groundDark: '#1a2231', groundLight: '#2e3a4f',
  path: '#12100f', pathEdge: '#2c2c38', accent: '#bcd3ff', rock: '#39415a',
};

/** The three spectrum-upgrade branches offered between waves. */
export const SPECTRUM_TREE = [
  { id: 'emberPlus', branch: 'Ember', name: 'Kindled Glass', text: 'Ember beams burn +35%.', max: 3 },
  { id: 'gildedPlus', branch: 'Gilded', name: 'Solar Mint', text: 'Gilded beams deal +35% damage.', max: 3 },
  { id: 'umbralPlus', branch: 'Umbral', name: 'Deep Violet', text: 'Umbral slow is +12% stronger.', max: 3 },
  { id: 'longerLight', branch: 'Optics', name: 'Polished Path', text: 'The beam travels 12% farther.', max: 3 },
  { id: 'wideBeam', branch: 'Optics', name: 'Broad Aperture', text: 'The beam is 20% wider.', max: 2 },
  { id: 'richKills', branch: 'Bounty', name: 'Ashen Tithe', text: 'Shades drop +15% gold.', max: 3 },
  { id: 'crystalWard', branch: 'Heart', name: 'Crystal Ward', text: 'Restore 2 lives, +1 max life.', max: 5 },
  { id: 'swiftHands', branch: 'Craft', name: 'Quicksilver Hands', text: 'Towers cost 8% less to build.', max: 2 },
];
