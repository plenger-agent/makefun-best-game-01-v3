// The world: one run of HELIODROME, whole.
//
// makeWorld builds the state every other module reads: the run's gold and
// lives, the island under play, the towers on their pads, the shades on
// the road, the sun on its arc. stepWorld advances it one fixed step:
// sun, director, towers, shades, light, damage, consequences. Screens and
// rendering never mutate the world except through the actions exported
// here and in towers.js, which keeps the rules in exactly two places.

import { START, SPECTRUM_TREE, waveClearGold, interestOn, CAMPAIGN_WAVES } from './config.js';
import { ISLANDS } from './maps.js';
import { makeDirector, startWave, updateDirector, waveIslandIndex, isNightWave } from './waves.js';
import { updateEnemies, updateEclipseDisc, spawnEnemy } from './enemies.js';
import { updateTowers } from './towers.js';
import { traceBeams, applyBeamDamage } from './optics.js';
import { makeParticles, updateParticles, deathPuff, emberTrail } from './particles.js';
import { makeRng } from './rng.js';
import { recordRun } from './save.js';

/** Create a fresh world (title screen showing, no run in progress). */
export function makeWorld(audio, save) {
  const world = {
    screen: 'title', // title | play | over | victory
    paused: false,
    endless: false,
    result: null,
    time: 0,
    wave: 0,
    gold: START.gold,
    lives: START.lives,
    maxLives: START.lives,
    score: 0,
    islandIndex: 0,
    island: ISLANDS[0],
    towers: [],
    enemies: [],
    effects: [],
    particles: makeParticles(),
    director: makeDirector(),
    tree: freshTree(),
    sun: { pos: { x: 200, y: 60 }, dir: { x: 0.4, y: 1 }, phase: 0 },
    night: false,
    eclipseDisc: null,
    bossRef: null,
    beams: { segments: [], glows: [] },
    selected: null,
    buildKind: null,
    offer: null, // between-wave spectrum choices, when offered
    banner: null, // {title, sub, t, ttl}
    shake: 0,
    speed: save?.speed || 1,
    stats: { kills: 0, earned: 0, leaked: 0 },
    rng: makeRng(20261),
    audio,
    save,
    uiRegions: [],
    statusLine: 'HELIODROME: Bend the Noon.',
  };
  // The optics, towers and enemies report through the world object.
  world.killEnemy = (enemy, cause) => killEnemy(world, enemy, cause);
  world.leakEnemy = (enemy) => leakEnemy(world, enemy);
  return world;
}

/** All spectrum-tree levels at zero. */
export function freshTree() {
  const tree = {};
  for (const entry of SPECTRUM_TREE) tree[entry.id] = 0;
  return tree;
}

/** Begin a new campaign from wave 1 on the Dawn Coast. */
export function startRun(world) {
  world.wave = 1;
  world.gold = START.gold;
  world.lives = START.lives;
  world.maxLives = START.lives;
  world.score = 0;
  world.towers = [];
  world.enemies = [];
  world.effects = [];
  world.tree = freshTree();
  world.director = makeDirector();
  world.endless = false;
  world.result = null;
  world.paused = false;
  world.selected = null;
  world.buildKind = null;
  world.offer = null;
  world.stats = { kills: 0, earned: 0, leaked: 0 };
  setIsland(world, 0);
  world.screen = 'play';
  showBanner(world, 'Dawn Coast', 'Place a mirror. Bend the noon. Press SPACE to call the first wave.');
}

/** Move the run to an island; standing glass is refunded in full. */
export function setIsland(world, index) {
  if (index !== world.islandIndex || world.towers.length > 0) {
    for (const tower of world.towers) {
      world.gold += tower.spent;
      tower.pad.tower = null;
    }
    world.towers = [];
    world.selected = null;
  }
  world.islandIndex = index;
  world.island = ISLANDS[index];
  for (const pad of world.island.pads) pad.tower = null;
}

/** Show a centre banner for a few seconds (wave titles, warnings). */
export function showBanner(world, title, sub, ttl = 3.2) {
  world.banner = { title, sub, t: 0, ttl };
}

/**
 * The sun's arc: one full crossing every 80 seconds of play, mirrored by
 * the moon at night. The beam's entry angle follows the arc, so the
 * player's mirrors must keep re-bending the light as the day turns —
 * the core skill of the game.
 */
export function updateSun(world, dt) {
  world.sun.phase = (world.sun.phase + dt / 80) % 1;
  const p = world.sun.phase;
  const x = 110 + p * (1280 - 220);
  const y = 104 - Math.sin(p * Math.PI) * 58;
  const angle = (62 + p * 56) * (Math.PI / 180);
  world.sun.pos = { x, y };
  world.sun.dir = { x: Math.cos(angle), y: Math.sin(angle) };
}

/** Call the next wave (only from the build phase). */
export function callWave(world) {
  if (world.director.phase !== 'build' && world.director.phase !== 'cleared') return;
  world.night = isNightWave(world.wave);
  startWave(world);
  world.offer = null;
  showBanner(world, bannerTitleFor(world), bannerSubFor(world), 2.6);
  world.audio?.waveStart();
}

function bannerTitleFor(world) {
  if (world.wave % 10 === 0) return `Wave ${world.wave} — THE ECLIPSE`;
  if (world.night) return `Wave ${world.wave} — Nightfall`;
  return `Wave ${world.wave}`;
}

function bannerSubFor(world) {
  if (world.wave % 10 === 0) return 'Its shadow drinks the beam. Route the light around the disc.';
  if (world.night) return 'The moonbeam slows more than it burns. In shadow, the shades surge.';
  if (world.wave === 14) return 'Noon Desert. The road doubles back — one prism can hold two straights.';
  if (world.wave === 28) return 'Dusk Cliffs. The spiral is shadowed: umbral glass earns its keep.';
  return '';
}

/** Advance the whole world by one fixed step (1/60s of game time). */
export function stepWorld(world, dt) {
  world.time += dt;
  if (world.banner) {
    world.banner.t += dt;
    if (world.banner.t >= world.banner.ttl) world.banner = null;
  }
  for (const effect of world.effects) effect.t += dt;
  world.effects = world.effects.filter((e) => e.t < e.ttl);
  updateParticles(world.particles, dt);
  if (world.screen !== 'play' || world.paused) {
    // Even on menus, keep the sun and a gentle beam for the backdrop.
    updateSun(world, dt * 0.25);
    world.beams = traceBeams(world);
    return;
  }

  updateSun(world, dt);
  updateDirector(world, dt);
  updateTowers(world, dt);
  updateEnemies(world, dt);
  updateEclipseDisc(world);
  world.beams = traceBeams(world);
  applyBeamDamage(world, world.beams.segments, dt);
  for (const enemy of world.enemies) {
    if (enemy.alive && enemy.lit && enemy.burn > 0.4) emberTrail(world.particles, enemy, world.rng);
  }
  const burning = world.enemies.filter((e) => e.alive && e.lit).length;
  world.audio?.setHum(world.enemies.length ? burning / Math.max(6, world.enemies.length) : 0, world.night);
  if (world.shake > 0) world.shake = Math.max(0, world.shake - dt * 2.2);
  checkWaveEnd(world);
}

/** Wave end: the schedule is spent and the field is clear. */
function checkWaveEnd(world) {
  const director = world.director;
  if (director.phase !== 'fighting') return;
  if (world.enemies.some((e) => e.alive)) return;
  director.phase = 'cleared';
  const bonus = waveClearGold(world.wave) + interestOn(world.gold);
  world.gold += bonus;
  world.score += world.wave * 25 + bonus;
  world.audio?.waveClear();
  if (world.wave >= CAMPAIGN_WAVES && !world.endless) {
    world.result = 'victory';
    world.screen = 'victory';
    world.audio?.victory();
    if (world.save) recordRun(world.save, world);
    return;
  }
  world.wave += 1;
  // Crossing to a new island happens now, in the quiet, so the player
  // builds on the island the next wave will actually cross.
  setIsland(world, waveIslandIndex(world.wave));
  world.offer = rollOffer(world);
  showBanner(world, 'Wave cleared', `+${bonus} gold. Choose a spectrum blessing, then call wave ${world.wave}.`, 3.4);
}

/** Roll three spectrum-tree cards the player may still take. */
export function rollOffer(world) {
  const available = SPECTRUM_TREE.filter((entry) => world.tree[entry.id] < entry.max);
  const picks = [];
  const pool = [...available];
  while (picks.length < 3 && pool.length > 0) {
    const index = Math.floor(world.rng.next() * pool.length);
    picks.push(pool.splice(index, 1)[0]);
  }
  return picks;
}

/** Take a spectrum blessing from the between-wave offer. */
export function takeOffer(world, entry) {
  if (!world.offer || !world.offer.includes(entry)) return;
  world.tree[entry.id] += 1;
  if (entry.id === 'crystalWard') {
    world.maxLives += 1;
    world.lives = Math.min(world.maxLives, world.lives + 2);
  }
  world.offer = null;
  world.audio?.upgrade();
}

/** A shade dies: pay its bounty, burst its ash, split the husks. */
export function killEnemy(world, enemy, cause) {
  if (!enemy.alive) return;
  enemy.alive = false;
  const bounty = Math.round(enemy.reward * (1 + 0.15 * world.tree.richKills));
  world.gold += bounty;
  world.score += enemy.reward * 2;
  world.stats.kills += 1;
  world.stats.earned += bounty;
  deathPuff(world.particles, enemy.x, enemy.y, enemy.radius, world.rng);
  world.audio?.kill();
  if (enemy.kind === 'splitterbug') {
    for (const off of [-14, 10]) {
      const child = spawnEnemy(world, 'moth');
      child.dist = Math.max(0, enemy.dist + off);
      child.hp = child.maxHp * 0.7;
    }
  }
  if (enemy.kind === 'eclipse') {
    world.eclipseDisc = null;
    showBanner(world, 'THE ECLIPSE BREAKS', 'Sunlight returns to the whole field.', 3.4);
    world.shake = 0.7;
  }
}

/** A shade reaches the Heart Crystal: it costs lives, and maybe the run. */
export function leakEnemy(world, enemy) {
  world.lives -= enemy.leak;
  world.stats.leaked += 1;
  world.shake = Math.min(1, world.shake + 0.35);
  world.audio?.leak();
  world.effects.push({ kind: 'crystalHit', x: world.island.crystal.x, y: world.island.crystal.y, t: 0, ttl: 0.6, radius: 12 });
  if (world.lives <= 0) {
    world.lives = 0;
    world.result = 'over';
    world.screen = 'over';
    world.audio?.gameOver();
    if (world.save) recordRun(world.save, world);
  }
}

/** Continue past wave 40 in endless mode. */
export function enterEndless(world) {
  world.endless = true;
  world.screen = 'play';
  world.director.phase = 'cleared';
  showBanner(world, 'Endless Noon', 'The sun refuses to set. How long can the crystal hold?', 3.4);
}
