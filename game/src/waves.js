// The wave director: what the dark sends, and when.
//
// A wave is a spawn schedule built from a budget. The budget grows with
// the wave number; the roster unlocks in a taught order (moths first, so
// the player learns the beam; the Eclipse last, so they fear it). Boss
// waves are built by hand around their escort. Night waves skew fast and
// pale. Endless waves keep composing forever, richer and denser, cycling
// the islands.
//
// The director owns the between-wave rhythm too: a wave ends when its
// schedule is spent and the field is clear, and only then may the player
// open the spectrum tree and call the next wave.

import { BOSS_EVERY, CAMPAIGN_WAVES, NIGHT_EVERY } from './config.js';
import { islandForWave, islandForEndless } from './maps.js';
import { makeRng, hashSeed } from './rng.js';
import { spawnEnemy } from './enemies.js';

/** True when wave n is fought under the moonbeam. */
export function isNightWave(wave) {
  return wave % NIGHT_EVERY === 0;
}

/** True when wave n carries an aspect of THE ECLIPSE. */
export function isBossWave(wave) {
  return wave % BOSS_EVERY === 0;
}

/** Island index a wave is fought on (campaign ranges, then cycling). */
export function waveIslandIndex(wave) {
  return wave <= CAMPAIGN_WAVES ? islandForWave(wave) : islandForEndless(wave);
}

/** Roster in unlock order: [kind, firstWave, weight]. */
const ROSTER = [
  ['moth', 1, 10],
  ['crawler', 2, 6],
  ['wraith', 4, 5],
  ['swift', 6, 5],
  ['splitterbug', 8, 4],
  ['beetle', 9, 4],
  ['veil', 12, 3],
  ['shade', 16, 3],
  ['colossus', 19, 1],
];

/** Rough gold-value cost of one creature, for budgeting a wave. */
const BUDGET_COST = {
  moth: 1, crawler: 1.6, wraith: 1.8, swift: 2, splitterbug: 2.4,
  beetle: 3.4, veil: 3.2, shade: 5, colossus: 12, eclipse: 0,
};

/**
 * Build the spawn schedule for a wave: a list of {kind, at} with `at` in
 * seconds from the wave's start. Deterministic per wave number, so a
 * wave plays the same for everyone who meets it.
 */
export function composeWave(wave) {
  const rng = makeRng(hashSeed(`heliodrome-wave-${wave}`));
  const events = [];
  if (isBossWave(wave)) return composeBossWave(wave, rng);

  let budget = 9 + wave * 2.35 + Math.pow(Math.max(0, wave - 24), 1.6);
  if (isNightWave(wave)) budget *= 0.92;
  const pool = ROSTER.filter(([, first]) => wave >= first);
  let at = 1.2;
  let sincePack = 0;
  while (budget > 0) {
    const kind = pickKind(rng, pool, wave);
    const packSize = packOf(rng, kind);
    for (let i = 0; i < packSize; i += 1) {
      events.push({ kind, at });
      at += intervalOf(kind, wave);
      budget -= BUDGET_COST[kind];
      if (budget <= 0) break;
    }
    sincePack += 1;
    at += rng.range(0.7, 2.1); // A breath between packs.
    if (sincePack > 40) break;
  }
  return events;
}

/** Weighted pick from the unlocked roster; nights favour the fast and pale. */
function pickKind(rng, pool, wave) {
  let total = 0;
  const weights = pool.map(([kind, , weight]) => {
    let w = weight;
    if (isNightWave(wave) && (kind === 'swift' || kind === 'wraith')) w *= 1.9;
    if (isNightWave(wave) && kind === 'beetle') w *= 0.4;
    total += w;
    return w;
  });
  let roll = rng.next() * total;
  for (let i = 0; i < pool.length; i += 1) {
    roll -= weights[i];
    if (roll <= 0) return pool[i][0];
  }
  return pool[0][0];
}

/** How many of a kind arrive together. */
function packOf(rng, kind) {
  switch (kind) {
    case 'moth': return rng.int(3, 6);
    case 'swift': return rng.int(2, 5);
    case 'wraith': return rng.int(2, 4);
    case 'crawler': return rng.int(2, 3);
    case 'splitterbug': return rng.int(1, 3);
    case 'colossus': return 1;
    case 'shade': return rng.int(1, 2);
    default: return rng.int(1, 2);
  }
}

/** Seconds between individuals inside a pack. */
function intervalOf(kind, wave) {
  const base = { moth: 0.55, swift: 0.4, wraith: 0.7, crawler: 0.9, splitterbug: 0.8, beetle: 1.1, veil: 1.0, shade: 1.4, colossus: 2 }[kind] || 0.8;
  return base * Math.max(0.55, 1 - wave * 0.008);
}

/**
 * Boss waves: a thin escort first, to make the player spend attention,
 * then THE ECLIPSE at the half-minute with a honour guard behind it.
 */
function composeBossWave(wave, rng) {
  const events = [];
  let at = 1.0;
  const escort = Math.min(16, 5 + wave / 4);
  for (let i = 0; i < escort; i += 1) {
    events.push({ kind: rng.pick(['moth', 'wraith', 'crawler']), at });
    at += rng.range(0.5, 1.0);
  }
  at += 4;
  events.push({ kind: 'eclipse', at });
  at += 6;
  const guard = Math.min(10, 3 + wave / 6);
  for (let i = 0; i < guard; i += 1) {
    events.push({ kind: rng.pick(['beetle', 'veil', 'shade']), at });
    at += rng.range(1.2, 2.2);
  }
  return events;
}

/** Create the runtime director state for a fresh campaign. */
export function makeDirector() {
  return {
    phase: 'build', // build | spawning | fighting | cleared
    schedule: [],
    cursor: 0,
    clock: 0,
    spawned: 0,
    totalToSpawn: 0,
  };
}

/** Begin a wave: compose its schedule and reset the clock. */
export function startWave(world) {
  const director = world.director;
  director.schedule = composeWave(world.wave);
  director.totalToSpawn = director.schedule.length;
  director.cursor = 0;
  director.clock = 0;
  director.spawned = 0;
  director.phase = 'spawning';
  world.night = isNightWave(world.wave);
}

/** Spawn whatever is due; move the phase along when the schedule ends. */
export function updateDirector(world, dt) {
  const director = world.director;
  if (director.phase !== 'spawning') return;
  director.clock += dt;
  while (director.cursor < director.schedule.length && director.schedule[director.cursor].at <= director.clock) {
    spawnEnemy(world, director.schedule[director.cursor].kind);
    director.cursor += 1;
    director.spawned += 1;
  }
  if (director.cursor >= director.schedule.length) director.phase = 'fighting';
}

/** A short human label for the incoming wave, for the HUD and banners. */
export function waveTitle(wave) {
  if (isBossWave(wave)) return `Wave ${wave} — THE ECLIPSE`;
  if (isNightWave(wave)) return `Wave ${wave} — Nightfall`;
  return `Wave ${wave}`;
}
