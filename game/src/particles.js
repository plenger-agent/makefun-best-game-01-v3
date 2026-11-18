// Particles: the game's confetti of light and ash.
//
// One pooled system serves every effect: sparks where the beam strikes
// glass, embers off burning shades, ash when a shade dies, rings from the
// Dawn Bell, the Heart Crystal's slow breathing motes. Particles are
// plain records updated in place; the renderer draws them additively so
// light feels like light.

/** Create an empty particle pool. */
export function makeParticles() {
  return { list: [], cap: 900 };
}

/** Add one particle. Fields: position, velocity, life, size, colour, drag, gravity, glow. */
export function spawnParticle(pool, p) {
  if (pool.list.length >= pool.cap) pool.list.shift();
  pool.list.push({
    x: p.x, y: p.y,
    vx: p.vx || 0, vy: p.vy || 0,
    t: 0, ttl: p.ttl || 0.6,
    size: p.size || 3,
    colour: p.colour || '#ffd98a',
    drag: p.drag ?? 0.92,
    gravity: p.gravity ?? 0,
    glow: p.glow ?? true,
    shrink: p.shrink ?? true,
  });
}

/** A burst of sparks where light strikes glass or a shade bursts. */
export function burst(pool, x, y, colour, count, speed, rng) {
  for (let i = 0; i < count; i += 1) {
    const angle = rng.range(0, Math.PI * 2);
    const v = rng.range(speed * 0.25, speed);
    spawnParticle(pool, {
      x, y,
      vx: Math.cos(angle) * v, vy: Math.sin(angle) * v - 12,
      ttl: rng.range(0.25, 0.7), size: rng.range(1.5, 3.6),
      colour, gravity: 60, drag: 0.9,
    });
  }
}

/** A shade dies: a soft collapse of ash and one bright seed of light. */
export function deathPuff(pool, x, y, radius, rng) {
  burst(pool, x, y, '#8f86a8', Math.min(16, 6 + radius), 90, rng);
  burst(pool, x, y, '#ffe9a8', 5, 55, rng);
}

/** A burning shade sheds embers as it walks. */
export function emberTrail(pool, enemy, rng) {
  if (!rng.chance(0.35)) return;
  spawnParticle(pool, {
    x: enemy.x + rng.range(-6, 6), y: enemy.y + rng.range(-6, 6),
    vx: rng.range(-8, 8), vy: rng.range(-34, -14),
    ttl: rng.range(0.3, 0.6), size: rng.range(1.6, 3.2),
    colour: rng.pick(['#ff7a3c', '#ffc93c', '#ff9a5c']), gravity: -30, drag: 0.96,
  });
}

/** Advance every particle; dead ones are swapped out. */
export function updateParticles(pool, dt) {
  const list = pool.list;
  for (let i = list.length - 1; i >= 0; i -= 1) {
    const p = list[i];
    p.t += dt;
    if (p.t >= p.ttl) {
      list[i] = list[list.length - 1];
      list.pop();
      continue;
    }
    const dragK = Math.pow(p.drag, dt * 60);
    p.vx *= dragK;
    p.vy = p.vy * dragK + p.gravity * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
  }
}
