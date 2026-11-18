// The three islands: shade paths, build pads and dressing.
//
// Each island is one winding polyline the shades walk from the shadow edge
// (a cave mouth drawn at the first point) to the Heart Crystal (drawn at
// the last), plus a set of build pads — stone circles where towers may
// stand. Pads sit close enough to the path that a beam steered across two
// or three of them can rake long stretches of the road, which is the whole
// game: the sun only ever shines from one side, so the player's mirrors
// decide where the light actually falls.
//
// Coordinates are in the logical 1280x800 field; the ground rectangle is
// x 24..1256, y 128..688 (see config.js).

import { GROUND } from './config.js';
import { makeRng, hashSeed } from './rng.js';

/** One island definition: path, pads, and where the crystal stands. */
function island(name, path, pads, dressingSeed) {
  return {
    name,
    path,
    pads: pads.map(([x, y]) => ({ x, y })),
    crystal: path[path.length - 1],
    gate: path[0],
    dressing: makeDressing(name, dressingSeed),
  };
}

/**
 * Deterministic set dressing: rocks, tufts, shells and ruins scattered off
 * the path, drawn by the renderer as quiet texture so the ground never
 * looks flat. Points too near the road or a pad are skipped at build time
 * in the renderer, which knows both.
 */
function makeDressing(name, seed) {
  const rng = makeRng(hashSeed(name) ^ seed);
  const items = [];
  for (let i = 0; i < 90; i += 1) {
    items.push({
      x: GROUND.x + rng.range(6, GROUND.width - 6),
      y: GROUND.y + rng.range(6, GROUND.height - 6),
      kind: rng.pick(['rock', 'tuft', 'shell', 'rune', 'tuft', 'rock']),
      size: rng.range(3, 9),
      shade: rng.range(-0.16, 0.16),
      spin: rng.range(0, Math.PI * 2),
    });
  }
  return items;
}

/**
 * Dawn Coast: a lazy S from the west cave, down the beach and up to the
 * crystal on its eastern headland. Long straights favour gilded mirrors.
 */
const DAWN_COAST = island(
  'Dawn Coast',
  [
    { x: 8, y: 300 }, { x: 190, y: 300 }, { x: 300, y: 210 }, { x: 470, y: 210 },
    { x: 560, y: 330 }, { x: 560, y: 470 }, { x: 700, y: 540 }, { x: 900, y: 540 },
    { x: 1010, y: 430 }, { x: 1010, y: 260 }, { x: 1130, y: 200 }, { x: 1248, y: 200 },
  ],
  [
    [140, 380], [250, 250], [390, 290], [390, 140], [520, 260], [640, 400],
    [480, 520], [640, 590], [800, 470], [800, 610], [930, 350], [1090, 330],
    [1090, 480], [1160, 280], [180, 190], [950, 610],
  ],
  101,
);

/**
 * Noon Desert: a switchback canyon. The road doubles back on itself three
 * times, so one well-placed prism can hold two straights in its fan.
 */
const NOON_DESERT = island(
  'Noon Desert',
  [
    { x: 8, y: 190 }, { x: 330, y: 190 }, { x: 430, y: 280 }, { x: 430, y: 400 },
    { x: 250, y: 470 }, { x: 250, y: 580 }, { x: 560, y: 640 }, { x: 860, y: 640 },
    { x: 960, y: 540 }, { x: 960, y: 300 }, { x: 1080, y: 220 }, { x: 1248, y: 220 },
  ],
  [
    [180, 270], [180, 110], [360, 320], [540, 340], [560, 470], [380, 540],
    [700, 560], [700, 690 - 60], [880, 450], [1060, 380], [1060, 560], [1160, 300],
    [520, 200], [820, 240], [330, 640], [1150, 620],
  ],
  202,
);

/**
 * Dusk Cliffs: a spiral into the caldera where the crystal waits. The
 * innermost loop is in shadow of the rim for much of the day — umbral
 * mirrors earn their keep here.
 */
const DUSK_CLIFFS = island(
  'Dusk Cliffs',
  [
    { x: 8, y: 620 }, { x: 300, y: 620 }, { x: 460, y: 520 }, { x: 460, y: 240 },
    { x: 640, y: 160 }, { x: 1020, y: 160 }, { x: 1140, y: 280 }, { x: 1140, y: 520 },
    { x: 1000, y: 610 }, { x: 720, y: 610 }, { x: 640, y: 500 }, { x: 760, y: 400 },
    { x: 880, y: 400 },
  ],
  [
    [170, 540], [330, 690 - 40], [560, 420], [560, 300], [800, 240], [800, 90 + 40],
    [1020, 300], [1020, 460], [880, 540], [720, 420], [620, 580], [960, 660 - 30],
    [240, 380], [380, 160], [1080, 640], [500, 640],
  ],
  303,
);

/** The campaign's islands, in order. Wave ranges map onto them in waves.js. */
export const ISLANDS = [DAWN_COAST, NOON_DESERT, DUSK_CLIFFS];

/** Island index for a campaign wave (1-based): 13 / 14 / 13 split. */
export function islandForWave(wave) {
  if (wave <= 13) return 0;
  if (wave <= 27) return 1;
  return 2;
}

/** In endless mode the islands cycle and the paths mirror for variety. */
export function islandForEndless(wave) {
  return (wave - 1) % ISLANDS.length;
}
