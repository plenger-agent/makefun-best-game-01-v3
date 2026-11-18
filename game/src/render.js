// Rendering: everything the player sees, drawn fresh each frame.
//
// Layers, back to front: sky and sun (or moon), the island's ground
// (pre-rendered to an offscreen canvas per island and lighting, since it
// never changes mid-wave), the Heart Crystal and its glow, towers, the
// shades, the beams themselves — drawn additively in three passes so the
// light glows — then particles, effects, and finally the HUD and build
// bar. Buttons and cards register their rectangles into world.uiRegions
// as they are drawn; screens.js dispatches clicks against that list, so
// the visible interface and the clickable one can never drift apart.

import { FIELD, SKY_HEIGHT, BAR_HEIGHT, GROUND, SPECTRUM, TOWERS, ISLAND_ART, NIGHT_ART } from './config.js';
import { clamp, distance, smooth } from './geometry.js';

const groundCache = new Map();

/** Main entry: draw the whole scene for the current world state. */
export function drawScene(ctx, world, input) {
  world.uiRegions = [];
  ctx.save();
  if (world.shake > 0) {
    const s = world.shake * 7;
    ctx.translate((Math.random() - 0.5) * s, (Math.random() - 0.5) * s);
  }
  drawSky(ctx, world);
  drawGround(ctx, world);
  drawCrystal(ctx, world);
  drawPads(ctx, world, input);
  drawTowers(ctx, world);
  drawEnemies(ctx, world);
  drawBeams(ctx, world);
  drawEclipseDisc(ctx, world);
  drawEffects(ctx, world);
  drawParticles(ctx, world);
  ctx.restore();
  drawHud(ctx, world, input);
  drawBuildBar(ctx, world, input);
  if (world.banner) drawBanner(ctx, world);
}

/** Sky gradient, sun or moon with halo, stars and far clouds at night. */
function drawSky(ctx, world) {
  const art = world.night ? NIGHT_ART : ISLAND_ART[world.islandIndex];
  const grad = ctx.createLinearGradient(0, 0, 0, SKY_HEIGHT + 60);
  grad.addColorStop(0, art.skyTop);
  grad.addColorStop(0.62, art.skyMid);
  grad.addColorStop(1, art.skyLow);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, FIELD.width, SKY_HEIGHT + 60);

  if (world.night) {
    ctx.fillStyle = 'rgba(230,238,255,0.8)';
    for (let i = 0; i < 70; i += 1) {
      const sx = (i * 173.3) % FIELD.width;
      const sy = (i * 57.7) % (SKY_HEIGHT - 18);
      ctx.globalAlpha = 0.25 + ((i * 31) % 10) / 14;
      ctx.fillRect(sx, sy, 2, 2);
    }
    ctx.globalAlpha = 1;
  }

  const { x, y } = world.sun.pos;
  const sunR = world.night ? 21 : 27;
  const halo = ctx.createRadialGradient(x, y, 2, x, y, sunR * 4.6);
  if (world.night) {
    halo.addColorStop(0, 'rgba(190,210,255,0.55)');
    halo.addColorStop(1, 'rgba(190,210,255,0)');
  } else {
    halo.addColorStop(0, 'rgba(255,214,120,0.75)');
    halo.addColorStop(0.4, 'rgba(255,170,80,0.28)');
    halo.addColorStop(1, 'rgba(255,160,60,0)');
  }
  ctx.fillStyle = halo;
  ctx.beginPath();
  ctx.arc(x, y, sunR * 4.6, 0, Math.PI * 2);
  ctx.fill();
  const core = ctx.createRadialGradient(x - 4, y - 4, 1, x, y, sunR);
  if (world.night) {
    core.addColorStop(0, '#f4f8ff');
    core.addColorStop(1, '#aebfe8');
  } else {
    core.addColorStop(0, '#fffbe8');
    core.addColorStop(0.7, '#ffe9a0');
    core.addColorStop(1, '#ffb84e');
  }
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.arc(x, y, sunR, 0, Math.PI * 2);
  ctx.fill();
  if (world.night) {
    ctx.fillStyle = 'rgba(140,160,205,0.5)';
    ctx.beginPath();
    ctx.arc(x - 7, y - 5, 4, 0, Math.PI * 2);
    ctx.arc(x + 6, y + 8, 3, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** The island's ground, cached per island and lighting. */
function drawGround(ctx, world) {
  const key = `${world.islandIndex}-${world.night ? 'n' : 'd'}`;
  let cached = groundCache.get(key);
  if (!cached) {
    cached = document.createElement('canvas');
    cached.width = FIELD.width;
    cached.height = FIELD.height;
    paintGround(cached.getContext('2d'), world);
    groundCache.set(key, cached);
  }
  ctx.drawImage(cached, 0, 0);
}

/** Paint the static ground: sea rim, earth, the shade road, dressing. */
function paintGround(ctx, world) {
  const art = world.night ? NIGHT_ART : ISLAND_ART[world.islandIndex];
  const island = world.island;
  ctx.fillStyle = art.sea || '#274b63';
  ctx.fillRect(0, SKY_HEIGHT, FIELD.width, FIELD.height - SKY_HEIGHT);
  const grad = ctx.createLinearGradient(0, GROUND.y, 0, GROUND.y + GROUND.height);
  grad.addColorStop(0, art.groundLight);
  grad.addColorStop(0.5, art.ground);
  grad.addColorStop(1, art.groundDark);
  ctx.fillStyle = grad;
  roundRect(ctx, GROUND.x - 8, GROUND.y - 8, GROUND.width + 16, GROUND.height + 16, 26);
  ctx.fill();

  // Soft tonal blotches so the earth reads as terrain, not a fill.
  for (let i = 0; i < 26; i += 1) {
    const bx = GROUND.x + ((i * 211.7) % GROUND.width);
    const by = GROUND.y + ((i * 127.3) % GROUND.height);
    const br = 40 + ((i * 53) % 90);
    const blob = ctx.createRadialGradient(bx, by, 2, bx, by, br);
    blob.addColorStop(0, i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)');
    blob.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = blob;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fill();
  }

  // The shade road: a dark worn trail with a lighter worn edge.
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = art.pathEdge;
  ctx.lineWidth = 34;
  strokePath(ctx, island.path);
  ctx.strokeStyle = art.path;
  ctx.lineWidth = 27;
  strokePath(ctx, island.path);
  ctx.strokeStyle = 'rgba(0,0,0,0.18)';
  ctx.lineWidth = 3;
  ctx.setLineDash([14, 22]);
  strokePath(ctx, island.path);
  ctx.setLineDash([]);

  // The cave mouth at the gate.
  const gate = island.gate;
  ctx.fillStyle = '#0a0910';
  ctx.beginPath();
  ctx.ellipse(gate.x + 6, gate.y, 20, 30, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = art.rock;
  ctx.lineWidth = 5;
  ctx.beginPath();
  ctx.ellipse(gate.x + 6, gate.y, 20, 30, 0, Math.PI, Math.PI * 2);
  ctx.stroke();

  // Set dressing, kept off the road and the pads.
  for (const item of island.dressing) {
    if (nearPath(island, item.x, item.y, 26)) continue;
    if (island.pads.some((p) => distance(p, item) < 30)) continue;
    drawDressing(ctx, item, art);
  }
}

/** One quiet piece of terrain texture. */
function drawDressing(ctx, item, art) {
  ctx.save();
  ctx.translate(item.x, item.y);
  ctx.rotate(item.spin);
  if (item.kind === 'rock') {
    ctx.fillStyle = art.rock;
    ctx.globalAlpha = 0.55;
    ctx.beginPath();
    ctx.moveTo(-item.size, item.size * 0.6);
    ctx.lineTo(-item.size * 0.3, -item.size * 0.7);
    ctx.lineTo(item.size * 0.7, -item.size * 0.2);
    ctx.lineTo(item.size, item.size * 0.6);
    ctx.closePath();
    ctx.fill();
  } else if (item.kind === 'tuft') {
    ctx.strokeStyle = art.groundDark;
    ctx.globalAlpha = 0.8;
    ctx.lineWidth = 2;
    for (let b = -2; b <= 2; b += 1) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(b * 2.4, -item.size, b * 3.4, -item.size * 1.5);
      ctx.stroke();
    }
  } else if (item.kind === 'shell') {
    ctx.fillStyle = 'rgba(255,240,214,0.5)';
    ctx.beginPath();
    ctx.arc(0, 0, item.size * 0.55, Math.PI, 0);
    ctx.fill();
  } else {
    ctx.strokeStyle = art.accent;
    ctx.globalAlpha = 0.3;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.arc(0, 0, item.size * 0.7, 0, Math.PI * 2);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-item.size * 0.4, 0);
    ctx.lineTo(item.size * 0.4, 0);
    ctx.stroke();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** Stroke a polyline path. */
function strokePath(ctx, points) {
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) ctx.lineTo(points[i].x, points[i].y);
  ctx.stroke();
}

/** True when a point lies within `pad` px of the island's road. */
function nearPath(island, x, y, pad) {
  for (let i = 1; i < island.path.length; i += 1) {
    const a = island.path[i - 1];
    const b = island.path[i];
    const t = Math.max(0, Math.min(1, ((x - a.x) * (b.x - a.x) + (y - a.y) * (b.y - a.y)) / ((b.x - a.x) ** 2 + (b.y - a.y) ** 2 || 1)));
    const dx = x - (a.x + (b.x - a.x) * t);
    const dy = y - (a.y + (b.y - a.y) * t);
    if (dx * dx + dy * dy < pad * pad) return true;
  }
  return false;
}

/** The Heart Crystal: a faceted gem on a stone plinth, breathing light. */
function drawCrystal(ctx, world) {
  const c = world.island.crystal;
  const pulse = 0.5 + 0.5 * Math.sin(world.time * 2.2);
  const glow = ctx.createRadialGradient(c.x, c.y, 2, c.x, c.y, 66 + pulse * 14);
  glow.addColorStop(0, 'rgba(255,120,160,0.4)');
  glow.addColorStop(1, 'rgba(255,120,160,0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.arc(c.x, c.y, 80, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#3c3644';
  ctx.beginPath();
  ctx.ellipse(c.x, c.y + 16, 24, 9, 0, 0, Math.PI * 2);
  ctx.fill();
  const w = 15;
  const h = 24 + pulse * 2;
  const grad = ctx.createLinearGradient(c.x - w, c.y - h, c.x + w, c.y + h);
  grad.addColorStop(0, '#ffd3e2');
  grad.addColorStop(0.45, '#ff7ba9');
  grad.addColorStop(1, '#c23a6e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - h);
  ctx.lineTo(c.x + w, c.y - 2);
  ctx.lineTo(c.x + w * 0.55, c.y + h * 0.7);
  ctx.lineTo(c.x - w * 0.55, c.y + h * 0.7);
  ctx.lineTo(c.x - w, c.y - 2);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.65)';
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.moveTo(c.x, c.y - h);
  ctx.lineTo(c.x, c.y + h * 0.55);
  ctx.moveTo(c.x - w, c.y - 2);
  ctx.lineTo(c.x + w, c.y - 2);
  ctx.stroke();
  const health = world.maxLives ? world.lives / world.maxLives : 0;
  ctx.fillStyle = 'rgba(10,8,14,0.55)';
  roundRect(ctx, c.x - 24, c.y + 30, 48, 6, 3);
  ctx.fill();
  ctx.fillStyle = health > 0.35 ? '#ff8fb5' : '#ff5252';
  roundRect(ctx, c.x - 24, c.y + 30, 48 * clamp(health, 0, 1), 6, 3);
  ctx.fill();
}

/** Build pads: stone circles; hover and affordability are shown. */
function drawPads(ctx, world, input) {
  for (const pad of world.island.pads) {
    if (pad.tower) continue;
    const hover = input && distance(input.mouse, pad) < 24;
    const afford = world.buildKind ? world.gold >= (world.buildKind ? 0 : 0) : true;
    ctx.fillStyle = hover ? 'rgba(255,240,200,0.34)' : 'rgba(20,16,24,0.28)';
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, 21, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = hover ? '#ffe9a8' : 'rgba(255,244,214,0.4)';
    ctx.lineWidth = hover ? 2.4 : 1.6;
    ctx.setLineDash([5, 5]);
    ctx.beginPath();
    ctx.arc(pad.x, pad.y, 21, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    if (world.buildKind && hover) {
      ctx.fillStyle = 'rgba(255,249,230,0.9)';
      ctx.beginPath();
      ctx.arc(pad.x, pad.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }
    void afford;
  }
}

/** Every standing tower, drawn to its kind. */
function drawTowers(ctx, world) {
  for (const tower of world.towers) {
    ctx.save();
    ctx.translate(tower.x, tower.y);
    // Stone base shared by all glass.
    ctx.fillStyle = 'rgba(24,20,30,0.4)';
    ctx.beginPath();
    ctx.ellipse(0, 10, 20, 7, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#575064';
    ctx.beginPath();
    ctx.arc(0, 6, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#6e6780';
    ctx.beginPath();
    ctx.arc(0, 3, 10, 0, Math.PI * 2);
    ctx.fill();
    switch (tower.kind) {
      case 'mirror': drawMirror(ctx, tower, world); break;
      case 'prism': drawPrism(ctx, tower, world); break;
      case 'lens': drawLens(ctx, tower, world); break;
      case 'splitter': drawSplitter(ctx, tower, world); break;
      case 'bell': drawBell(ctx, tower, world); break;
      case 'shard': drawShard(ctx, tower, world); break;
      default: break;
    }
    if (tower.level > 0) {
      ctx.fillStyle = '#ffd98a';
      for (let i = 0; i < tower.level; i += 1) {
        ctx.beginPath();
        ctx.arc(-8 + i * 8, 17, 2.2, 0, Math.PI * 2);
        ctx.fill();
      }
    }
    ctx.restore();
    if (world.selected === tower) {
      ctx.strokeStyle = 'rgba(255,233,168,0.95)';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(tower.x, tower.y, 27 + Math.sin(world.time * 5) * 2, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** A mirror: a bright bar of glass on a pivot, drawn at its angle. */
function drawMirror(ctx, tower) {
  ctx.save();
  ctx.rotate(tower.angle);
  const grad = ctx.createLinearGradient(0, -5, 0, 5);
  grad.addColorStop(0, '#fdfdff');
  grad.addColorStop(0.5, '#b9c9e8');
  grad.addColorStop(1, '#7e93bd');
  ctx.fillStyle = grad;
  roundRect(ctx, -tower.radius, -4.6, tower.radius * 2, 9.2, 4);
  ctx.fill();
  ctx.strokeStyle = '#3d4457';
  ctx.lineWidth = 1.6;
  roundRect(ctx, -tower.radius, -4.6, tower.radius * 2, 9.2, 4);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = '#2e2a38';
  ctx.beginPath();
  ctx.arc(0, 0, 4.4, 0, Math.PI * 2);
  ctx.fill();
}

/** A prism: a triangle that glows with the three colours it makes. */
function drawPrism(ctx, tower, world) {
  const pulse = 0.75 + 0.25 * Math.sin(world.time * 3 + tower.id);
  ctx.beginPath();
  ctx.moveTo(0, -16);
  ctx.lineTo(14, 10);
  ctx.lineTo(-14, 10);
  ctx.closePath();
  const grad = ctx.createLinearGradient(-14, 0, 14, 0);
  grad.addColorStop(0, `rgba(255,122,60,${0.85 * pulse})`);
  grad.addColorStop(0.5, `rgba(255,233,168,${0.95 * pulse})`);
  grad.addColorStop(1, `rgba(154,107,255,${0.85 * pulse})`);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.8)';
  ctx.lineWidth = 1.4;
  ctx.stroke();
}

/** A lens: concentric glass rings that brighten as beams pass. */
function drawLens(ctx, tower) {
  for (let r = 15; r > 4; r -= 5) {
    ctx.strokeStyle = `rgba(190,225,255,${0.35 + (15 - r) * 0.05})`;
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.arc(0, -2, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = 'rgba(220,240,255,0.85)';
  ctx.beginPath();
  ctx.arc(0, -2, 3.4, 0, Math.PI * 2);
  ctx.fill();
}

/** A splitter: a Y of glass — stem down, two arms up. */
function drawSplitter(ctx) {
  ctx.strokeStyle = '#dfe9ff';
  ctx.lineWidth = 5;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(0, 12);
  ctx.lineTo(0, -2);
  ctx.moveTo(0, -2);
  ctx.lineTo(-10, -14);
  ctx.moveTo(0, -2);
  ctx.lineTo(10, -14);
  ctx.stroke();
  ctx.fillStyle = '#fff6d8';
  for (const [x, y] of [[0, 12], [-10, -14], [10, -14], [0, -2]]) {
    ctx.beginPath();
    ctx.arc(x, y, 2.6, 0, Math.PI * 2);
    ctx.fill();
  }
}

/** A dawn bell: brass, with a clapper that swings as its ring nears. */
function drawBell(ctx, tower, world) {
  const swing = Math.sin(world.time * 2.4 + tower.id) * (tower.timer < 2 ? 0.4 : 0.08);
  ctx.fillStyle = '#8a6a2f';
  ctx.fillRect(-2, -18, 4, 6);
  const grad = ctx.createLinearGradient(-12, -12, 12, 12);
  grad.addColorStop(0, '#ffe9a0');
  grad.addColorStop(0.55, '#d9a83f');
  grad.addColorStop(1, '#9a742a');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(11, -12, 12, 4);
  ctx.quadraticCurveTo(12, 10, 15, 12);
  ctx.lineTo(-15, 12);
  ctx.quadraticCurveTo(-12, 10, -12, 4);
  ctx.quadraticCurveTo(-11, -12, 0, -13);
  ctx.fill();
  ctx.save();
  ctx.rotate(swing);
  ctx.fillStyle = '#5d451a';
  ctx.beginPath();
  ctx.arc(0, 13, 3, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** An eclipse shard: black glass that fills with stolen sunlight. */
function drawShard(ctx, tower) {
  const charge = tower.charge || 0;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(9, 2);
  ctx.lineTo(4, 14);
  ctx.lineTo(-5, 14);
  ctx.lineTo(-10, -2);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, -18, 0, 14);
  grad.addColorStop(0, '#241d33');
  grad.addColorStop(1, '#0d0a16');
  ctx.fillStyle = grad;
  ctx.fill();
  if (charge > 0.02) {
    ctx.save();
    ctx.clip();
    ctx.fillStyle = `rgba(255,196,80,${0.35 + charge * 0.6})`;
    const h = 32 * charge;
    ctx.fillRect(-11, 14 - h, 22, h);
    ctx.restore();
  }
  ctx.strokeStyle = charge >= 1 ? '#ffd98a' : '#4a4066';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(9, 2);
  ctx.lineTo(4, 14);
  ctx.lineTo(-5, 14);
  ctx.lineTo(-10, -2);
  ctx.closePath();
  ctx.stroke();
}

/** The beam itself: three additive passes — halo, body, core. */
function drawBeams(ctx, world) {
  const { segments, glows } = world.beams;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.lineCap = 'round';
  const passes = [
    { width: 15, alpha: 0.10 },
    { width: 7, alpha: 0.22 },
    { width: 2.6, alpha: 0.85 },
  ];
  for (const pass of passes) {
    for (const seg of segments) {
      const spec = SPECTRUM[seg.colour];
      ctx.strokeStyle = pass.width < 3 ? spec.core : spec.css;
      ctx.globalAlpha = pass.alpha * Math.min(1, 0.35 + seg.power * 0.75);
      ctx.lineWidth = pass.width * (1 + 0.2 * world.tree.wideBeam) * (0.7 + Math.min(0.6, seg.power * 0.3));
      ctx.beginPath();
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  for (const glow of glows) {
    const spec = SPECTRUM[glow.colour];
    const g = ctx.createRadialGradient(glow.x, glow.y, 0, glow.x, glow.y, 13);
    g.addColorStop(0, spec.core);
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(glow.x, glow.y, 13, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

/** The Eclipse's shadow disc: a black coin with a burning rim. */
function drawEclipseDisc(ctx, world) {
  const disc = world.eclipseDisc;
  if (!disc) return;
  const grad = ctx.createRadialGradient(disc.x, disc.y, disc.radius * 0.55, disc.x, disc.y, disc.radius * 1.25);
  grad.addColorStop(0, 'rgba(4,3,10,0.97)');
  grad.addColorStop(0.72, 'rgba(4,3,10,0.94)');
  grad.addColorStop(0.85, 'rgba(30,16,54,0.55)');
  grad.addColorStop(1, 'rgba(30,16,54,0)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.radius * 1.25, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,150,80,0.5)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(disc.x, disc.y, disc.radius * 0.86, 0, Math.PI * 2);
  ctx.stroke();
}

/** Shades, each kind with its own silhouette; health bars when hurt. */
function drawEnemies(ctx, world) {
  const sorted = [...world.enemies].sort((a, b) => a.y - b.y);
  for (const enemy of sorted) {
    if (!enemy.alive) continue;
    ctx.save();
    ctx.translate(enemy.x, enemy.y);
    ctx.fillStyle = 'rgba(8,6,14,0.35)';
    ctx.beginPath();
    ctx.ellipse(0, enemy.radius * 0.8, enemy.radius * 0.9, enemy.radius * 0.32, 0, 0, Math.PI * 2);
    ctx.fill();
    switch (enemy.kind) {
      case 'moth': drawMoth(ctx, enemy, world); break;
      case 'crawler': drawCrawler(ctx, enemy, world); break;
      case 'wraith': drawWraith(ctx, enemy, world); break;
      case 'beetle': drawBeetle(ctx, enemy, world); break;
      case 'swift': drawSwift(ctx, enemy, world); break;
      case 'shade': drawShade(ctx, enemy, world); break;
      case 'splitterbug': drawHusk(ctx, enemy, world); break;
      case 'veil': drawVeil(ctx, enemy, world); break;
      case 'colossus': drawColossus(ctx, enemy, world); break;
      case 'eclipse': drawEclipse(ctx, enemy, world); break;
      default: break;
    }
    ctx.restore();
    if (enemy.lit) {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = 'rgba(255,190,90,0.20)';
      ctx.beginPath();
      ctx.arc(enemy.x, enemy.y, enemy.radius * 1.25, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
    if (enemy.hp < enemy.maxHp) {
      const w = Math.max(22, enemy.radius * 1.7);
      ctx.fillStyle = 'rgba(8,6,12,0.6)';
      roundRect(ctx, enemy.x - w / 2, enemy.y - enemy.radius - 11, w, 4.4, 2);
      ctx.fill();
      ctx.fillStyle = enemy.slowFactor > 0 ? '#9a6bff' : '#ffcf5c';
      roundRect(ctx, enemy.x - w / 2, enemy.y - enemy.radius - 11, w * clamp(enemy.hp / enemy.maxHp, 0, 1), 4.4, 2);
      ctx.fill();
    }
  }
}

/** Duskmoth: two wings that beat, a body of soot. */
function drawMoth(ctx, enemy, world) {
  const beat = Math.sin(world.time * 16 + enemy.wobble * 5) * 0.55;
  ctx.fillStyle = '#4a4258';
  for (const side of [-1, 1]) {
    ctx.save();
    ctx.scale(side, 1);
    ctx.rotate(-0.5 - beat * side * 0.4);
    ctx.beginPath();
    ctx.ellipse(9, -3, 10, 5.4, -0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#241f30';
  ctx.beginPath();
  ctx.ellipse(0, 0, 4.6, 7.6, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#c9b8ff';
  ctx.beginPath();
  ctx.arc(-1.8, -4.4, 1.1, 0, Math.PI * 2);
  ctx.arc(1.8, -4.4, 1.1, 0, Math.PI * 2);
  ctx.fill();
}

/** Gloomcrawler: armoured segments that ripple as it walks. */
function drawCrawler(ctx, enemy, world) {
  const dir = enemy.dir || { x: 1, y: 0 };
  const ang = Math.atan2(dir.y, dir.x);
  ctx.rotate(ang);
  for (let i = 3; i >= 0; i -= 1) {
    const off = -i * 8;
    const lift = Math.sin(world.time * 7 + enemy.wobble + i) * 1.6;
    ctx.fillStyle = i % 2 ? '#332c44' : '#3e3552';
    ctx.beginPath();
    ctx.arc(off, lift * 0.3, 8.4 - i * 0.7, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#57496e';
  ctx.beginPath();
  ctx.arc(4, 0, 6.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#ffb0a0';
  ctx.beginPath();
  ctx.arc(6.4, -2.4, 1.3, 0, Math.PI * 2);
  ctx.arc(6.4, 2.4, 1.3, 0, Math.PI * 2);
  ctx.fill();
}

/** Pale Wraith: a translucent ghost with a trailing hem. */
function drawWraith(ctx, enemy, world) {
  const sway = Math.sin(world.time * 3.4 + enemy.wobble) * 2;
  ctx.save();
  ctx.translate(sway * 0.4, Math.sin(world.time * 2.2 + enemy.wobble) * 2.4);
  const grad = ctx.createLinearGradient(0, -14, 0, 14);
  grad.addColorStop(0, 'rgba(214,226,255,0.92)');
  grad.addColorStop(1, 'rgba(160,170,220,0.25)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -13);
  ctx.quadraticCurveTo(10, -10, 9, 2);
  ctx.quadraticCurveTo(12, 12, 6, 10);
  ctx.quadraticCurveTo(2, 14, 0, 10);
  ctx.quadraticCurveTo(-2, 14, -6, 10);
  ctx.quadraticCurveTo(-12, 12, -9, 2);
  ctx.quadraticCurveTo(-10, -10, 0, -13);
  ctx.fill();
  ctx.fillStyle = '#141126';
  ctx.beginPath();
  ctx.arc(-3.4, -4, 1.7, 0, Math.PI * 2);
  ctx.arc(3.4, -4, 1.7, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, 1.4, 2.2, 3.2, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Umbral Beetle: a dome of chitin with a horn. */
function drawBeetle(ctx, enemy) {
  const grad = ctx.createRadialGradient(-4, -6, 2, 0, 0, 19);
  grad.addColorStop(0, '#4e4470');
  grad.addColorStop(1, '#1d1830');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.ellipse(0, 0, 16, 13, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = '#120e20';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -12);
  ctx.lineTo(0, 12);
  ctx.stroke();
  ctx.strokeStyle = '#6a5a94';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(10, -4);
  ctx.quadraticCurveTo(18, -8, 20, -14);
  ctx.stroke();
  ctx.fillStyle = '#c9b8ff';
  ctx.beginPath();
  ctx.arc(8, -1, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Nightswift: a dart of shadow, motion-blurred. */
function drawSwift(ctx, enemy) {
  const dir = enemy.dir || { x: 1, y: 0 };
  ctx.rotate(Math.atan2(dir.y, dir.x));
  ctx.fillStyle = 'rgba(30,26,48,0.5)';
  ctx.beginPath();
  ctx.moveTo(-16, 0);
  ctx.lineTo(-4, -5);
  ctx.lineTo(-4, 5);
  ctx.closePath();
  ctx.fill();
  const grad = ctx.createLinearGradient(-8, 0, 12, 0);
  grad.addColorStop(0, '#2c2544');
  grad.addColorStop(1, '#57496e');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(12, 0);
  ctx.lineTo(-6, -6);
  ctx.lineTo(-9, 0);
  ctx.lineTo(-6, 6);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ffd2a0';
  ctx.beginPath();
  ctx.arc(5, 0, 1.6, 0, Math.PI * 2);
  ctx.fill();
}

/** Greater Shade: a tall figure of smoke with ember eyes. */
function drawShade(ctx, enemy, world) {
  const flicker = Math.sin(world.time * 5 + enemy.wobble * 3) * 1.6;
  const grad = ctx.createLinearGradient(0, -22, 0, 20);
  grad.addColorStop(0, '#17122a');
  grad.addColorStop(1, 'rgba(23,18,42,0.35)');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.quadraticCurveTo(13, -14, 11 + flicker, 6);
  ctx.quadraticCurveTo(13, 18, 5, 15);
  ctx.quadraticCurveTo(0, 20, -5, 15);
  ctx.quadraticCurveTo(-13, 18, -11 + flicker, 6);
  ctx.quadraticCurveTo(-13, -14, 0, -21);
  ctx.fill();
  ctx.fillStyle = '#ff9a5c';
  ctx.beginPath();
  ctx.arc(-4, -9, 1.9, 0, Math.PI * 2);
  ctx.arc(4, -9, 1.9, 0, Math.PI * 2);
  ctx.fill();
}

/** Mitosis Husk: two fused spheres that pulse against each other. */
function drawHusk(ctx, enemy, world) {
  const pulse = 1 + Math.sin(world.time * 6 + enemy.wobble) * 0.08;
  ctx.fillStyle = '#3a3153';
  ctx.beginPath();
  ctx.arc(-6 * pulse, 0, 10.4, 0, Math.PI * 2);
  ctx.arc(6 * pulse, 0, 10.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#584a7a';
  ctx.beginPath();
  ctx.arc(-6 * pulse, -2, 5.4, 0, Math.PI * 2);
  ctx.arc(6 * pulse, -2, 5.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#0f0c1c';
  ctx.beginPath();
  ctx.arc(-6 * pulse, -2, 2, 0, Math.PI * 2);
  ctx.arc(6 * pulse, -2, 2, 0, Math.PI * 2);
  ctx.fill();
}

/** Veilspinner: a spider of shade under a shimmering woven veil. */
function drawVeil(ctx, enemy, world) {
  ctx.strokeStyle = '#241f36';
  ctx.lineWidth = 2.2;
  for (let leg = 0; leg < 4; leg += 1) {
    const a = (leg / 4) * Math.PI - 0.4 + Math.sin(world.time * 8 + leg * 2) * 0.14;
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.lineTo(Math.cos(a) * 14 * side, Math.sin(a) * 10 + 6);
      ctx.stroke();
    }
  }
  ctx.fillStyle = '#2c2547';
  ctx.beginPath();
  ctx.ellipse(0, 0, 9.4, 7.6, 0, 0, Math.PI * 2);
  ctx.fill();
  if (enemy.veiled) {
    ctx.strokeStyle = `rgba(190,200,255,${0.5 + 0.3 * Math.sin(world.time * 9)})`;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -2, 15, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.fillStyle = '#e2d4ff';
  ctx.beginPath();
  ctx.arc(-3, -2, 1.4, 0, Math.PI * 2);
  ctx.arc(3, -2, 1.4, 0, Math.PI * 2);
  ctx.fill();
}

/** Gloom Colossus: a walking hill of rock and soot. */
function drawColossus(ctx, enemy, world) {
  const bob = Math.sin(world.time * 2.6 + enemy.wobble) * 1.4;
  ctx.save();
  ctx.translate(0, bob);
  const grad = ctx.createLinearGradient(0, -26, 0, 24);
  grad.addColorStop(0, '#3c3355');
  grad.addColorStop(1, '#171226');
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.moveTo(-20, 20);
  ctx.lineTo(-16, -8);
  ctx.lineTo(-7, -22);
  ctx.lineTo(8, -24);
  ctx.lineTo(17, -8);
  ctx.lineTo(20, 20);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = '#ff7a3c';
  ctx.beginPath();
  ctx.arc(-5, -10, 2.4, 0, Math.PI * 2);
  ctx.arc(6, -10, 2.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,150,80,0.75)';
  ctx.fillRect(-7, 2, 15, 2.4);
  ctx.restore();
}

/** THE ECLIPSE: a crowned void, the largest thing on the field. */
function drawEclipse(ctx, enemy, world) {
  const pulse = 1 + Math.sin(world.time * 1.8) * 0.03;
  ctx.save();
  ctx.scale(pulse, pulse);
  const corona = ctx.createRadialGradient(0, 0, 26, 0, 0, 52);
  corona.addColorStop(0, 'rgba(255,120,60,0.5)');
  corona.addColorStop(0.6, 'rgba(160,60,160,0.22)');
  corona.addColorStop(1, 'rgba(120,40,160,0)');
  ctx.fillStyle = corona;
  ctx.beginPath();
  ctx.arc(0, 0, 52, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = '#05030c';
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,170,90,0.85)';
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.arc(0, 0, 30, 0, Math.PI * 2);
  ctx.stroke();
  // Crown spikes.
  ctx.fillStyle = '#0a0616';
  for (let i = 0; i < 7; i += 1) {
    const a = (i / 7) * Math.PI * 2 + world.time * 0.24;
    ctx.save();
    ctx.rotate(a);
    ctx.beginPath();
    ctx.moveTo(28, -4);
    ctx.lineTo(44, 0);
    ctx.lineTo(28, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }
  ctx.fillStyle = '#ffb37a';
  ctx.beginPath();
  ctx.arc(-8, -3, 2.6, 0, Math.PI * 2);
  ctx.arc(8, -3, 2.6, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** Transient effects: bell rings, shard lances, crystal strikes. */
function drawEffects(ctx, world) {
  for (const effect of world.effects) {
    const k = effect.t / effect.ttl;
    if (effect.kind === 'ring') {
      ctx.strokeStyle = `rgba(255,220,140,${0.7 * (1 - k)})`;
      ctx.lineWidth = 3.4 * (1 - k) + 0.6;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius + k * 260, 0, Math.PI * 2);
      ctx.stroke();
    } else if (effect.kind === 'lance') {
      ctx.save();
      ctx.globalCompositeOperation = 'lighter';
      ctx.strokeStyle = `rgba(255,214,130,${0.9 * (1 - k)})`;
      ctx.lineWidth = 7 * (1 - k) + 1;
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
      ctx.strokeStyle = `rgba(255,255,240,${0.95 * (1 - k)})`;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(effect.x1, effect.y1);
      ctx.lineTo(effect.x2, effect.y2);
      ctx.stroke();
      ctx.restore();
    } else if (effect.kind === 'crystalHit') {
      ctx.strokeStyle = `rgba(255,90,120,${0.85 * (1 - k)})`;
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(effect.x, effect.y, effect.radius + k * 46, 0, Math.PI * 2);
      ctx.stroke();
    }
  }
}

/** All live particles, additive. */
function drawParticles(ctx, world) {
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (const p of world.particles.list) {
    const life = 1 - p.t / p.ttl;
    ctx.globalAlpha = life * 0.9;
    ctx.fillStyle = p.colour;
    const size = p.shrink ? p.size * life + 0.4 : p.size;
    ctx.beginPath();
    ctx.arc(p.x, p.y, size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.globalAlpha = 1;
}

/** The top HUD: wave, gold, lives, score, and the sun dial. */
function drawHud(ctx, world, input) {
  ctx.fillStyle = 'rgba(10,9,18,0.72)';
  ctx.fillRect(0, 0, FIELD.width, 46);
  ctx.fillStyle = 'rgba(255,220,150,0.25)';
  ctx.fillRect(0, 46, FIELD.width, 1.4);
  ctx.textBaseline = 'middle';

  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 19px Georgia, serif';
  ctx.textAlign = 'left';
  ctx.fillText('HELIODROME', 18, 24);

  ctx.font = '600 15px system-ui, sans-serif';
  ctx.fillStyle = '#f4ecd8';
  const phase = world.director.phase;
  const waveLabel = world.screen === 'play'
    ? (phase === 'build' || phase === 'cleared' ? `Next: Wave ${world.wave}` : `Wave ${world.wave}`)
    : `Wave ${Math.max(1, world.wave)}`;
  ctx.fillText(waveLabel, 196, 24);
  ctx.fillStyle = world.night ? '#bcd3ff' : '#ffd98a';
  ctx.fillText(world.island.name + (world.night ? ' · Night' : ''), 330, 24);

  drawStat(ctx, 560, 'Gold', `${world.gold}`, '#ffd94e');
  drawStat(ctx, 672, 'Lives', `${world.lives}`, '#ff8fb5');
  drawStat(ctx, 784, 'Score', `${world.score}`, '#bfe3ff');
  const left = world.director.totalToSpawn - world.director.spawned + world.enemies.filter((e) => e.alive).length;
  drawStat(ctx, 916, 'Shades', `${Math.max(0, left)}`, '#c9b8ff');

  drawSunDial(ctx, world, 1064, 23);
  registerButton(ctx, world, 1120, 9, 66, 28, world.paused ? 'Resume' : 'Pause', 'pause', input, world.paused);
  registerButton(ctx, world, 1194, 9, 34, 28, `${world.speed}×`, 'speed', input, false);
  registerButton(ctx, world, 1236, 9, 30, 28, world.audio?.muted ? '✕' : '♪', 'mute', input, false);
}

/** One HUD stat: small label over a bright value. */
function drawStat(ctx, x, label, value, colour) {
  ctx.textAlign = 'left';
  ctx.font = '600 9.5px system-ui, sans-serif';
  ctx.fillStyle = 'rgba(240,235,220,0.55)';
  ctx.fillText(label.toUpperCase(), x, 14);
  ctx.font = '700 16px system-ui, sans-serif';
  ctx.fillStyle = colour;
  ctx.fillText(value, x, 31);
}

/** The sun dial: an arc the sun crosses; a dot rides it. */
function drawSunDial(ctx, world, cx, cy) {
  ctx.strokeStyle = 'rgba(255,233,168,0.4)';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(cx, cy + 12, 15, Math.PI, Math.PI * 2);
  ctx.stroke();
  const p = world.sun.phase;
  const a = Math.PI + p * Math.PI;
  const x = cx + Math.cos(a) * 15;
  const y = cy + 12 + Math.sin(a) * 15;
  ctx.fillStyle = world.night ? '#bcd3ff' : '#ffd94e';
  ctx.beginPath();
  ctx.arc(x, y, 3.6, 0, Math.PI * 2);
  ctx.fill();
}

/** A HUD/build button; registers its hit region as a side effect. */
export function registerButton(ctx, world, x, y, w, h, label, action, input, active, data) {
  const hover = input && input.mouse.x >= x && input.mouse.x <= x + w && input.mouse.y >= y && input.mouse.y <= y + h;
  ctx.fillStyle = active ? 'rgba(255,201,60,0.85)' : hover ? 'rgba(70,60,90,0.92)' : 'rgba(38,34,54,0.9)';
  roundRect(ctx, x, y, w, h, 7);
  ctx.fill();
  ctx.strokeStyle = active ? '#ffe9a8' : 'rgba(255,240,200,0.35)';
  ctx.lineWidth = 1.2;
  roundRect(ctx, x, y, w, h, 7);
  ctx.stroke();
  ctx.fillStyle = active ? '#241a08' : '#f4ecd8';
  ctx.font = '600 12.5px system-ui, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label, x + w / 2, y + h / 2 + 0.5);
  ctx.textAlign = 'left';
  world.uiRegions.push({ x, y, w, h, action, data });
  return hover;
}

/** The bottom build bar: tower cards, selection panel, call-wave button. */
function drawBuildBar(ctx, world, input) {
  const y = FIELD.height - BAR_HEIGHT;
  ctx.fillStyle = 'rgba(10,9,18,0.78)';
  ctx.fillRect(0, y, FIELD.width, BAR_HEIGHT);
  ctx.fillStyle = 'rgba(255,220,150,0.25)';
  ctx.fillRect(0, y, FIELD.width, 1.4);
  if (world.screen !== 'play') return;

  let x = 16;
  for (const [kind, spec] of Object.entries(TOWERS)) {
    const cost = Math.round(spec.cost * (1 - 0.08 * world.tree.swiftHands));
    const afford = world.gold >= cost;
    const selected = world.buildKind === kind;
    ctx.fillStyle = selected ? 'rgba(255,201,60,0.9)' : afford ? 'rgba(44,40,64,0.95)' : 'rgba(30,28,42,0.8)';
    roundRect(ctx, x, y + 10, 104, 66, 9);
    ctx.fill();
    ctx.strokeStyle = selected ? '#ffe9a8' : 'rgba(255,240,200,0.3)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, x, y + 10, 104, 66, 9);
    ctx.stroke();
    ctx.fillStyle = selected ? '#241a08' : '#f4ecd8';
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(spec.name, x + 52, y + 27);
    ctx.font = '600 12px system-ui, sans-serif';
    ctx.fillStyle = selected ? '#5d451a' : afford ? '#ffd94e' : '#8a8296';
    ctx.fillText(`${cost} gold · ${spec.key}`, x + 52, y + 47);
    ctx.fillStyle = selected ? 'rgba(36,26,8,0.75)' : 'rgba(240,235,220,0.55)';
    ctx.font = '10px system-ui, sans-serif';
    ctx.fillText(kind === 'mirror' ? 'rotates' : kind === 'prism' ? '3 colours' : kind === 'lens' ? '+80% dmg' : kind === 'splitter' ? '2 beams' : kind === 'bell' ? 'slow aura' : 'lance', x + 52, y + 63);
    ctx.textAlign = 'left';
    world.uiRegions.push({ x, y: y + 10, w: 104, h: 66, action: 'buildKind', data: kind });
    x += 112;
  }

  drawSelectionPanel(ctx, world, input, x + 4, y);

  const phase = world.director.phase;
  if (phase === 'build' || phase === 'cleared') {
    registerButton(ctx, world, 1096, y + 16, 168, 56, world.wave <= 1 && phase === 'build' ? '▶  Call Wave 1' : `▶  Call Wave ${world.wave}`, 'callWave', input, true);
  } else {
    ctx.fillStyle = 'rgba(240,235,220,0.6)';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(phase === 'spawning' ? 'The shades are coming…' : 'The shades are on the road…', 1180, y + 44);
    ctx.textAlign = 'left';
  }
}

/** Info and actions for the selected tower (or a hint when none). */
function drawSelectionPanel(ctx, world, input, x, y) {
  const tower = world.selected;
  ctx.font = '12px system-ui, sans-serif';
  if (!tower) {
    ctx.fillStyle = 'rgba(240,235,220,0.6)';
    const hint = world.buildKind
      ? 'Click a stone pad to build. Q / E or the wheel rotates aimed glass.'
      : 'Pick a tower card, or click standing glass to aim and upgrade it.';
    ctx.fillText(hint, x, y + 40);
    return;
  }
  const spec = TOWERS[tower.kind];
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 13.5px system-ui, sans-serif';
  ctx.fillText(`${spec.name} · Lv ${tower.level + 1}`, x, y + 22);
  ctx.fillStyle = 'rgba(240,235,220,0.75)';
  ctx.font = '11.5px system-ui, sans-serif';
  ctx.fillText(spec.blurb, x, y + 40);
  if (tower.kind === 'mirror' || tower.kind === 'shard') {
    ctx.fillText('Q / E or wheel: rotate', x, y + 57);
  }
  const upCost = tower.level >= 3 ? null : [70, 130, 240][tower.level];
  if (upCost !== null) {
    registerButton(ctx, world, x + 250, y + 12, 108, 26, `Upgrade ${upCost}g`, 'upgrade', input, false);
  } else {
    ctx.fillStyle = '#ffd94e';
    ctx.fillText('Fully polished', x + 250, y + 25);
  }
  registerButton(ctx, world, x + 250, y + 44, 108, 26, `Sell ${Math.floor(tower.spent * 0.7)}g`, 'sell', input, false);
}

/** Centre banner: wave titles and warnings, fading in and out. */
function drawBanner(ctx, world) {
  const banner = world.banner;
  const fade = Math.min(1, banner.t * 4) * (banner.t > banner.ttl - 0.5 ? Math.max(0, (banner.ttl - banner.t) * 2) : 1);
  ctx.save();
  ctx.globalAlpha = fade * smooth(Math.min(1, banner.t * 3));
  ctx.textAlign = 'center';
  ctx.fillStyle = 'rgba(8,6,14,0.45)';
  roundRect(ctx, FIELD.width / 2 - 330, 128, 660, banner.sub ? 86 : 62, 14);
  ctx.fill();
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 30px Georgia, serif';
  ctx.fillText(banner.title, FIELD.width / 2, banner.sub ? 162 : 168);
  if (banner.sub) {
    ctx.fillStyle = '#f4ecd8';
    ctx.font = '14.5px system-ui, sans-serif';
    ctx.fillText(banner.sub, FIELD.width / 2, 190);
  }
  ctx.restore();
  ctx.textAlign = 'left';
}

/** Rounded rectangle path (does not fill or stroke). */
export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.lineTo(x + w - rr, y);
  ctx.arcTo(x + w, y, x + w, y + rr, rr);
  ctx.lineTo(x + w, y + h - rr);
  ctx.arcTo(x + w, y + h, x + w - rr, y + h, rr);
  ctx.lineTo(x + rr, y + h);
  ctx.arcTo(x, y + h, x, y + h - rr, rr);
  ctx.lineTo(x, y + rr);
  ctx.arcTo(x, y, x + rr, y, rr);
  ctx.closePath();
}
