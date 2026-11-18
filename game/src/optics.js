// The optics: tracing the sunbeam through the player's glass.
//
// One beam of sunlight enters from the sun. What it becomes is decided
// here, sixty times a second: mirrors reflect it, prisms fan it into the
// spectrum, lenses focus it, splitters fork it, eclipse shards drink it,
// and the Eclipse's shadow disc swallows it whole. The tracer walks a
// stack of beam states; each state is one straight run of light with a
// colour, a power and a remaining length budget. Every run ends at the
// nearest event along its ray, and the event decides what continues.
//
// The tracer is pure geometry — it reads the world's towers and sun and
// returns segments. Damage is applied separately in applyBeamDamage, so
// the renderer can draw exactly the segments that hurt.

import { SPECTRUM, BEAM_MAX_LENGTH, BEAM_MAX_EVENTS, BEAM_RADIUS, FIELD } from './config.js';
import { rayCircle, raySegment, reflect, rotate, closestOnSegment, fromAngle } from './geometry.js';

/** A fresh beam state leaving the sun (or a splitting tower). */
function beamState(origin, dir, colour, power, budget, lenses) {
  return { origin, dir, colour, power, budget, lenses: lenses || new Set() };
}

/** The mirror's reflective face: a segment through its centre at its angle. */
function mirrorFace(tower) {
  const along = fromAngle(tower.angle);
  return {
    a: { x: tower.x - along.x * tower.radius, y: tower.y - along.y * tower.radius },
    b: { x: tower.x + along.x * tower.radius, y: tower.y + along.y * tower.radius },
    normal: { x: -along.y, y: along.x },
  };
}

/** Distance at which the ray leaves the field rectangle, or Infinity. */
function rayExitField(origin, dir) {
  let t = Infinity;
  if (dir.x > 1e-9) t = Math.min(t, (FIELD.width - origin.x) / dir.x);
  if (dir.x < -1e-9) t = Math.min(t, (0 - origin.x) / dir.x);
  if (dir.y > 1e-9) t = Math.min(t, (FIELD.height - origin.y) / dir.y);
  if (dir.y < -1e-9) t = Math.min(t, (0 - origin.y) / dir.y);
  return t;
}

/**
 * Trace every beam in the world. Returns { segments, glows } where each
 * segment is {x1, y1, x2, y2, colour, power} and glows are the bright
 * points where beams strike glass, for the renderer's sparkle pass.
 */
export function traceBeams(world) {
  const segments = [];
  const glows = [];
  const startColour = world.night ? 'moon' : 'white';
  const lengthScale = 1 + 0.12 * world.tree.longerLight;
  const stack = [beamState(world.sun.pos, world.sun.dir, startColour, 1, BEAM_MAX_LENGTH * lengthScale, null)];
  let events = 0;

  while (stack.length > 0 && events < BEAM_MAX_EVENTS) {
    const beam = stack.pop();
    if (beam.budget <= 4 || beam.power < 0.03) continue;
    const hit = nearestEvent(world, beam);
    const travel = Math.min(hit.t, beam.budget);
    const end = {
      x: beam.origin.x + beam.dir.x * travel,
      y: beam.origin.y + beam.dir.y * travel,
    };
    segments.push({ x1: beam.origin.x, y1: beam.origin.y, x2: end.x, y2: end.y, colour: beam.colour, power: beam.power });
    if (hit.t > beam.budget || hit.kind === 'exit') continue;
    events += 1;
    glows.push({ x: end.x, y: end.y, colour: beam.colour });
    continueBeam(world, stack, beam, hit, end);
  }
  return { segments, glows };
}

/** The nearest thing a beam run strikes: a tower, the shadow disc, or open sky. */
function nearestEvent(world, beam) {
  let best = { t: rayExitField(beam.origin, beam.dir), kind: 'exit', tower: null };
  const consider = (t, kind, tower) => {
    if (t < best.t && t > 0.5) best = { t, kind, tower };
  };
  for (const tower of world.towers) {
    if (!tower.built) continue;
    if (tower.kind === 'mirror') {
      const face = mirrorFace(tower);
      const hit = raySegment(beam.origin, beam.dir, face.a, face.b);
      if (hit) consider(hit.t, 'mirror', tower);
    } else if (tower.kind === 'prism' || tower.kind === 'splitter' || tower.kind === 'shard') {
      consider(rayCircle(beam.origin, beam.dir, tower, tower.radius), tower.kind, tower);
    } else if (tower.kind === 'lens') {
      if (!beam.lenses.has(tower.id)) {
        consider(rayCircle(beam.origin, beam.dir, tower, tower.radius), 'lens', tower);
      }
    }
    // Dawn bells are passive (a dawn aura, not glass): beams pass over them.
  }
  if (world.eclipseDisc) {
    consider(rayCircle(beam.origin, beam.dir, world.eclipseDisc, world.eclipseDisc.radius), 'shadow', null);
  }
  return best;
}

/** Spawn whatever continues past an event: reflections, fans, forks, focus. */
function continueBeam(world, stack, beam, hit, at) {
  const tower = hit.tower;
  const spent = hit.t;
  const rest = beam.budget - spent;
  if (rest <= 4) return;
  const nudge = (dir) => ({ x: at.x + dir.x * 1.5, y: at.y + dir.y * 1.5 });
  switch (hit.kind) {
    case 'mirror': {
      const face = mirrorFace(tower);
      let n = face.normal;
      if (n.x * beam.dir.x + n.y * beam.dir.y > 0) n = { x: -n.x, y: -n.y };
      const dir = reflect(beam.dir, n);
      stack.push(beamState(nudge(dir), dir, beam.colour, beam.power * 0.96 * towerPower(tower), rest, beam.lenses));
      break;
    }
    case 'prism': {
      // Sunlight fans into the spectrum; a coloured beam is polished brighter.
      if (beam.colour === 'white' || beam.colour === 'moon') {
        const fan = [['ember', -0.30], ['gilded', 0], ['umbral', 0.30]];
        for (const [colour, off] of fan) {
          const dir = rotate(beam.dir, off);
          stack.push(beamState(nudge(dir), dir, colour, beam.power * 0.62 * towerPower(tower), rest, beam.lenses));
        }
      } else {
        stack.push(beamState(nudge(beam.dir), beam.dir, beam.colour, beam.power * 1.25 * towerPower(tower), rest, beam.lenses));
      }
      break;
    }
    case 'splitter': {
      for (const off of [-0.38, 0.38]) {
        const dir = rotate(beam.dir, off);
        stack.push(beamState(nudge(dir), dir, beam.colour, beam.power * 0.6 * towerPower(tower), rest, beam.lenses));
      }
      break;
    }
    case 'lens': {
      const lenses = new Set(beam.lenses);
      lenses.add(tower.id);
      stack.push(beamState(nudge(beam.dir), beam.dir, beam.colour, beam.power * 1.8 * towerPower(tower), rest * 1.35, lenses));
      break;
    }
    case 'shard': {
      tower.charge = Math.min(1, (tower.charge || 0) + 0.34 * beam.power);
      break;
    }
    case 'shadow':
    default:
      break; // Swallowed by the Eclipse's shade: the run simply ends.
  }
}

/** A tower's level scales the beams it touches (upgrade levels 0..3). */
function towerPower(tower) {
  return 1 + 0.35 * (tower.level || 0);
}

/**
 * Hurt every creature the traced segments touch. Fills per-enemy light
 * state the enemy update reads: lit (burning instead of healing), the
 * strongest slow upon it, and burn stacks for the damage-over-time pass.
 */
export function applyBeamDamage(world, segments, dt) {
  const widthScale = 1 + 0.2 * world.tree.wideBeam;
  for (const enemy of world.enemies) {
    if (!enemy.alive) continue;
    let lit = false;
    for (const seg of segments) {
      const near = closestOnSegment(enemy, { x: seg.x1, y: seg.y1 }, { x: seg.x2, y: seg.y2 });
      const reach = BEAM_RADIUS * widthScale + enemy.radius * 0.45;
      if (near.dist > reach) continue;
      lit = true;
      const spec = SPECTRUM[seg.colour];
      const falloff = 1 - (near.dist / reach) * 0.35;
      const power = seg.power * falloff;
      let dps = spec.dps * power;
      if (seg.colour === 'ember') dps *= 1 + 0.35 * world.tree.emberPlus;
      if (seg.colour === 'gilded') dps *= 1 + 0.35 * world.tree.gildedPlus;
      if (enemy.armour) dps *= 1 - enemy.armour; // A veilspinner's woven shade.
      enemy.hp -= dps * dt;
      if (spec.burn > 0) enemy.burn = Math.min(6, enemy.burn + spec.burn * power * dt);
      if (spec.slow > 0) {
        const slow = Math.min(0.75, spec.slow * (seg.colour === 'umbral' ? 1 + 0.12 * world.tree.umbralPlus : 1));
        if (slow > enemy.slowFactor) {
          enemy.slowFactor = slow;
          enemy.slowTime = Math.max(enemy.slowTime, spec.slowTime);
        }
      }
      if (enemy.hp <= 0 && enemy.alive) world.killEnemy(enemy, seg.colour);
    }
    enemy.lit = lit;
  }
}
