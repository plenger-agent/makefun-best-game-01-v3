// Shade creatures: spawning, walking the path, burning, healing, dying.
//
// An enemy is a point travelling the island's polyline by arc length.
// Each step it advances by its speed — cut by whatever slow the light has
// laid on it — then the light's bookkeeping runs: burning stacks tick
// down as damage, and a creature standing in shadow knits itself back
// together (by day). Night inverts the bargain: in shadow the shades
// surge forward faster, and only the moonbeam's deep slow holds them.
//
// Deaths are reported to the world (gold, particles, sound); arrivals at
// the Heart Crystal cost lives. The Eclipse is an enemy like any other
// here, except that it carries the shadow disc the optics must respect.

import { ENEMIES, waveHpScale, waveSpeedScale } from './config.js';
import { pointAlong, polylineLength } from './geometry.js';

let nextEnemyId = 1;

/** Create an enemy of `kind` at the start of the island's path. */
export function spawnEnemy(world, kind) {
  const base = ENEMIES[kind];
  const hp = base.hp * waveHpScale(world.wave) * (kind === 'eclipse' ? 1 + (world.wave / 10 - 1) * 0.8 : 1);
  const enemy = {
    id: nextEnemyId,
    kind,
    x: world.island.gate.x,
    y: world.island.gate.y,
    dist: 0,
    hp,
    maxHp: hp,
    speed: base.speed * waveSpeedScale(world.wave),
    radius: base.radius,
    reward: base.reward,
    leak: base.leak,
    shadeHeal: base.shadeHeal,
    burn: 0,
    slowFactor: 0,
    slowTime: 0,
    lit: false,
    alive: true,
    wobble: (nextEnemyId * 7919) % 628 / 100,
    veilTimer: kind === 'veil' ? 4 : 0,
    veiled: false,
    bornAt: world.time,
  };
  nextEnemyId += 1;
  world.enemies.push(enemy);
  return enemy;
}

/** Advance every living enemy one step; reap arrivals and the burned. */
export function updateEnemies(world, dt) {
  const pathLength = polylineLength(world.island.path);
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;

    // Slows laid by the light fade; veils come and go on their own clock.
    if (enemy.slowTime > 0) {
      enemy.slowTime -= dt;
      if (enemy.slowTime <= 0) enemy.slowFactor = 0;
    }
    if (enemy.kind === 'veil') {
      enemy.veilTimer -= dt;
      if (enemy.veilTimer <= 0) {
        enemy.veiled = !enemy.veiled;
        enemy.veilTimer = enemy.veiled ? 2.2 : 6.5;
      }
    }
    enemy.armour = enemy.veiled ? 0.65 : 0;

    // Burning stacks: damage over time the light already paid for.
    if (enemy.burn > 0) {
      const tick = Math.min(enemy.burn, 22 * dt);
      enemy.burn -= tick * 0.55;
      enemy.hp -= tick * 2.4;
      if (enemy.hp <= 0) {
        world.killEnemy(enemy, 'burn');
        continue;
      }
    }

    // The shadow bargain: unlit shades heal by day; by night they surge.
    let speedScale = 1 - enemy.slowFactor;
    if (!enemy.lit) {
      if (world.night) speedScale *= 1.25;
      else enemy.hp = Math.min(enemy.maxHp, enemy.hp + enemy.shadeHeal * dt);
    }

    enemy.dist += enemy.speed * speedScale * dt;
    const placed = pointAlong(world.island.path, enemy.dist);
    // A gentle perpendicular sway so a column of shades reads as creatures,
    // not beads on a wire. Bosses and colossi are too heavy to sway.
    const sway = enemy.radius < 20 ? Math.sin(world.time * 2.1 + enemy.wobble) * 4 : 0;
    enemy.x = placed.point.x + -placed.dir.y * sway;
    enemy.y = placed.point.y + placed.dir.x * sway;
    enemy.dir = placed.dir;

    if (enemy.dist >= pathLength - 2) {
      enemy.alive = false;
      enemy.arrived = true;
      world.leakEnemy(enemy);
    }
  }
  world.enemies = world.enemies.filter((e) => e.alive);
}

/**
 * The Eclipse drags its shadow with it: a disc that orbits the boss
 * slowly, swallowing any beam that tries to cross it. When no boss is on
 * the field there is no disc.
 */
export function updateEclipseDisc(world) {
  const boss = world.enemies.find((e) => e.alive && e.kind === 'eclipse');
  if (!boss) {
    world.eclipseDisc = null;
    return;
  }
  const orbit = world.time * 0.7;
  world.eclipseDisc = {
    x: boss.x + Math.cos(orbit) * 88,
    y: boss.y + Math.sin(orbit) * 88 - 20,
    radius: 76,
  };
  world.bossRef = boss;
}

/** True while any living enemy remains (the wave is not yet cleared). */
export function anyEnemyAlive(world) {
  return world.enemies.some((e) => e.alive);
}
