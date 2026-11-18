// Screenshot scenes: ?shot=title|battle|eclipse|night|victory&seed=n.
//
// Each scene builds a real game state with the real rules — towers bought
// through buildTower, shades spawned through spawnEnemy, the simulation
// stepped forward so beams burn and particles fly — and then freezes it
// (world.shotMode) for the camera. Nothing is composited: what the shot
// shows is what a player would see, arranged at its most eloquent. The
// tower placements are chosen against the sun's geometry for the scene's
// phase, so the beam genuinely routes through the glass onto the road.

import { STEP } from './config.js';
import { startRun, stepWorld, setIsland } from './world.js';
import { buildTower } from './towers.js';
import { spawnEnemy } from './enemies.js';
import { waveIslandIndex } from './waves.js';
import { polylineLength } from './geometry.js';

/** Install a scene when the URL asks for one; otherwise do nothing. */
export function installShotScene(world, params) {
  const shot = params.get('shot');
  if (!shot) return;
  const builders = {
    title: buildTitleScene,
    battle: buildBattleScene,
    eclipse: buildEclipseScene,
    night: buildNightScene,
    victory: buildVictoryScene,
  };
  const build = builders[shot];
  if (!build) return;
  build(world);
  world.shotMode = true;
}

/** Buy a tower on the pad nearest (x, y), aimed and levelled for the scene. */
function dress(world, kind, x, y, angle, level = 0) {
  let pad = null;
  let best = Infinity;
  for (const p of world.island.pads) {
    const d = Math.hypot(p.x - x, p.y - y);
    if (d < best && !p.tower) {
      best = d;
      pad = p;
    }
  }
  if (!pad) return null;
  const tower = buildTower(world, kind, pad);
  if (!tower) return null;
  if (angle !== undefined) tower.angle = angle;
  tower.level = level;
  return tower;
}

/** Spawn a shade and walk it to a fraction of the road's length. */
function place(world, kind, fraction, hpScale = 1) {
  const enemy = spawnEnemy(world, kind);
  enemy.dist = polylineLength(world.island.path) * fraction;
  enemy.hp = enemy.maxHp * hpScale;
  return enemy;
}

/** Step the simulation forward `seconds` so the scene is mid-action. */
function settle(world, seconds) {
  const steps = Math.round(seconds / STEP);
  for (let i = 0; i < steps; i += 1) stepWorld(world, STEP);
}

/**
 * Present the frozen moment as mid-wave: the HUD counts the shades on
 * the road, and any banner is the scene's own words (or none).
 */
function freezeMidWave(world, banner) {
  const alive = world.enemies.length;
  world.director.phase = 'fighting';
  world.director.totalToSpawn = alive;
  world.director.spawned = alive;
  world.banner = banner;
}

/** Common opening: a run with deep pockets for dressing, then honest gold. */
function openRun(world, wave) {
  startRun(world);
  world.gold = 9999;
  world.wave = wave;
  setIsland(world, waveIslandIndex(wave));
}

/**
 * The cover: the title over a living Dawn Coast. At phase 0.36 the beam
 * falls dead onto the prism at (520, 260), so a three-colour fan glows
 * behind the title while the first moths cross the road.
 */
function buildTitleScene(world) {
  openRun(world, 1);
  dress(world, 'mirror', 250, 250, Math.PI * 0.78, 1);
  dress(world, 'prism', 520, 260, 0, 0);
  dress(world, 'mirror', 640, 400, Math.PI * 0.3, 0);
  world.sun.phase = 0.36;
  world.gold = 165;
  world.screen = 'play';
  place(world, 'moth', 0.1);
  place(world, 'moth', 0.16);
  place(world, 'crawler', 0.05);
  settle(world, 1.6);
  world.screen = 'title';
  world.banner = null;
}

/**
 * The money shot: wave 6 on the Dawn Coast. The beam falls on the prism
 * at (520, 260); its ember strand rakes the road's central vertical and
 * the diagonal below it, the gilded strand grazes the corner, and the
 * umbral strand is caught by the mirror at (480, 520) and bent back up
 * across the corner — a swarm burning inside all three colours.
 */
function buildBattleScene(world) {
  openRun(world, 6);
  dress(world, 'prism', 520, 260, 0, 1);
  dress(world, 'mirror', 480, 520, 0.567, 1);
  dress(world, 'splitter', 800, 470, 0, 0);
  dress(world, 'bell', 950, 610, 0, 0);
  world.sun.phase = 0.36;
  world.gold = 240;
  world.lives = 18;
  world.score = 1240;
  world.stats = { kills: 38, earned: 640, leaked: 2 };
  place(world, 'crawler', 0.19, 0.9);
  place(world, 'moth', 0.13);
  place(world, 'beetle', 0.345, 0.85);
  place(world, 'crawler', 0.385, 0.7);
  place(world, 'moth', 0.405);
  place(world, 'moth', 0.425, 0.8);
  place(world, 'wraith', 0.45, 0.75);
  place(world, 'splitterbug', 0.475, 0.7);
  place(world, 'crawler', 0.5, 0.6);
  place(world, 'moth', 0.525, 0.85);
  place(world, 'swift', 0.56);
  place(world, 'wraith', 0.595, 0.8);
  place(world, 'moth', 0.635);
  settle(world, 1.4);
  freezeMidWave(world, { title: 'Wave 6', sub: 'Bend the noon. Burn the road.', t: 0.3, ttl: 99 });
}

/**
 * The boss: THE ECLIPSE over the Dusk Cliffs spiral. At phase 0.40 the
 * beam falls dead onto the prism at (560, 300) and its ember strand
 * crosses the spiral's inner roads; the boss walks the upper diagonal
 * with its honour guard while the shadow disc rides up-right of it,
 * clear of the beam, and the crystal waits at the spiral's heart.
 */
function buildEclipseScene(world) {
  openRun(world, 30);
  dress(world, 'prism', 560, 300, 0, 2);
  dress(world, 'splitter', 1020, 460, 0, 1);
  dress(world, 'mirror', 1020, 300, Math.PI * 0.85, 1);
  dress(world, 'shard', 720, 420, 0, 1);
  dress(world, 'bell', 620, 580, 0, 0);
  world.sun.phase = 0.4;
  world.gold = 410;
  world.lives = 14;
  world.score = 8640;
  world.stats = { kills: 388, earned: 5210, leaked: 6 };
  place(world, 'eclipse', 0.38, 0.92);
  place(world, 'shade', 0.345, 0.85);
  place(world, 'beetle', 0.47, 0.9);
  place(world, 'veil', 0.58);
  place(world, 'wraith', 0.68, 0.85);
  place(world, 'crawler', 0.8, 0.8);
  place(world, 'moth', 0.86);
  settle(world, 1.6);
  // One last step with the orbit angle chosen, so the disc settles
  // beside the boss at the orbit's widest reach — the boss stays
  // visible, crowned, with its shadow moon riding alongside.
  world.eclipseAngle = 0.15 - STEP * 0.35;
  stepWorld(world, STEP);
  freezeMidWave(world, { title: 'THE ECLIPSE', sub: 'Something vast crosses the sun.', t: 0.3, ttl: 99 });
}

/**
 * Nightfall on the Noon Desert: at phase 0.36 the moonbeam falls on the
 * prism at (520, 200), fans into colour, and its gilded strand is forked
 * by the splitter at (560, 470) across the bottom switchbacks, where
 * the night swarm runs — surging in shadow, held by the violet strand.
 */
function buildNightScene(world) {
  openRun(world, 15);
  world.night = true;
  dress(world, 'prism', 520, 200, 0, 1);
  dress(world, 'splitter', 560, 470, 0, 0);
  dress(world, 'mirror', 360, 320, Math.PI * 0.35, 1);
  dress(world, 'lens', 880, 450, 0, 0);
  dress(world, 'bell', 330, 640, 0, 0);
  world.sun.phase = 0.36;
  world.gold = 320;
  world.lives = 16;
  world.score = 5210;
  world.stats = { kills: 204, earned: 2980, leaked: 4 };
  place(world, 'moth', 0.1);
  place(world, 'wraith', 0.2, 0.9);
  place(world, 'veil', 0.435, 0.9);
  place(world, 'crawler', 0.475, 0.8);
  place(world, 'moth', 0.51);
  place(world, 'swift', 0.525);
  place(world, 'swift', 0.56);
  place(world, 'wraith', 0.625, 0.85);
  place(world, 'wraith', 0.67);
  place(world, 'swift', 0.685);
  settle(world, 1.3);
  world.night = true; // Stepping may have recomputed it; the scene is night.
  freezeMidWave(world, null);
}

/**
 * The victory panel over a dressed Dusk Cliffs at dusk: the crystal
 * holds, the glass stands, the tallies show a campaign well fought.
 */
function buildVictoryScene(world) {
  openRun(world, 40);
  dress(world, 'prism', 560, 420, 0, 3);
  dress(world, 'mirror', 800, 240, Math.PI * 0.5, 2);
  dress(world, 'lens', 1020, 300, 0, 2);
  dress(world, 'shard', 720, 420, 0, 2);
  dress(world, 'bell', 620, 580, 0, 1);
  world.sun.phase = 0.78;
  world.gold = 275;
  world.lives = 9;
  world.score = 12480;
  world.stats = { kills: 612, earned: 8940, leaked: 11 };
  world.result = 'victory';
  settle(world, 0.8);
  world.screen = 'victory';
  world.banner = null;
}
