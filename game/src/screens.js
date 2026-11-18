// Screens and input dispatch: title, pause, spectrum blessings, endings.
//
// The renderer draws the world; this module draws what sits above it —
// the title screen with its instructions, the between-wave blessing
// cards, the pause veil, and the game-over and victory panels — and it
// owns every click and key, dispatched against the hit regions the
// renderer registered while drawing. One place for the interface rules:
// what a click means never depends on which module drew the button.

import { FIELD, TOWERS } from './config.js';
import { roundRect, registerButton } from './render.js';
import { buildTower, upgradeTower, sellTower, rotateTower, buildCost } from './towers.js';
import { startRun, callWave, takeOffer, enterEndless } from './world.js';
import { storeSave } from './save.js';
import { distance } from './geometry.js';

/** Draw whichever overlay the world's screen calls for. */
export function drawScreens(ctx, world, input) {
  if (world.screen === 'title') drawTitle(ctx, world, input);
  if (world.screen === 'over') drawEndPanel(ctx, world, input, false);
  if (world.screen === 'victory') drawEndPanel(ctx, world, input, true);
  if (world.screen === 'play' && world.offer && !world.paused) drawOffer(ctx, world, input);
  if (world.paused && world.screen === 'play') drawPause(ctx, world, input);
}

/** The title screen: name, premise, controls, records, and the way in. */
function drawTitle(ctx, world, input) {
  veil(ctx, 0.45);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 74px Georgia, serif';
  ctx.shadowColor = 'rgba(255,170,60,0.65)';
  ctx.shadowBlur = 34;
  ctx.fillText('HELIODROME', FIELD.width / 2, 218);
  ctx.shadowBlur = 0;
  ctx.fillStyle = '#fff6d8';
  ctx.font = 'italic 25px Georgia, serif';
  ctx.fillText('Bend the Noon', FIELD.width / 2, 258);

  ctx.fillStyle = 'rgba(244,236,216,0.92)';
  ctx.font = '16.5px system-ui, sans-serif';
  ctx.fillText('One beam of sunlight enters your island. The shades are coming for the Heart Crystal.', FIELD.width / 2, 316);
  ctx.fillText('Place mirrors and prisms of glass to steer the light across the road —', FIELD.width / 2, 342);
  ctx.fillText('they burn in the light, and heal in the shadow it leaves behind.', FIELD.width / 2, 368);

  const lines = [
    ['Build', 'Click a tower card (keys 1–6), then a stone pad.'],
    ['Aim', 'Click a mirror, then Q / E or the mouse wheel to rotate it. Prisms split the beam into burning colours.'],
    ['Survive', '40 waves, 3 islands, a boss — THE ECLIPSE — every 10th wave. Night waves invert the rules.'],
    ['Grow', 'After each wave, choose a spectrum blessing. The sun keeps moving: keep re-bending the light.'],
  ];
  ctx.textAlign = 'left';
  let y = 424;
  for (const [head, body] of lines) {
    ctx.fillStyle = '#ffd94e';
    ctx.font = '700 15px system-ui, sans-serif';
    ctx.fillText(head, 330, y);
    ctx.fillStyle = 'rgba(244,236,216,0.9)';
    ctx.font = '15px system-ui, sans-serif';
    ctx.fillText(body, 402, y);
    y += 30;
  }
  ctx.textAlign = 'center';

  const save = world.save;
  if (save && (save.bestWave > 0 || save.victories > 0)) {
    ctx.fillStyle = 'rgba(201,184,255,0.9)';
    ctx.font = '13.5px system-ui, sans-serif';
    ctx.fillText(`Your records: best wave ${save.bestWave} · best score ${save.bestScore} · victories ${save.victories} · lifetime kills ${save.lifetimeKills}`, FIELD.width / 2, y + 16);
  }

  registerButton(ctx, world, FIELD.width / 2 - 130, 596, 260, 58, '☀  Begin the Defence', 'start', input, true);
  ctx.fillStyle = 'rgba(244,236,216,0.55)';
  ctx.font = '12.5px system-ui, sans-serif';
  ctx.fillText('Mouse and keyboard · Space calls the next wave · P pauses · M mutes', FIELD.width / 2, 692);
  ctx.textAlign = 'left';
}

/** Between-wave blessing cards: three spectrum choices, one free pick. */
function drawOffer(ctx, world, input) {
  const offer = world.offer;
  if (!offer.length) return;
  const w = 300;
  const h = 148;
  const gap = 26;
  const total = offer.length * w + (offer.length - 1) * gap;
  let x = (FIELD.width - total) / 2;
  const y = 470;
  ctx.fillStyle = 'rgba(8,6,14,0.5)';
  ctx.fillRect(0, y - 42, FIELD.width, h + 96);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 19px Georgia, serif';
  ctx.fillText('The light settles. Choose a blessing:', FIELD.width / 2, y - 14);
  for (const entry of offer) {
    const hover = input.mouse.x >= x && input.mouse.x <= x + w && input.mouse.y >= y && input.mouse.y <= y + h;
    ctx.fillStyle = hover ? 'rgba(64,52,92,0.97)' : 'rgba(34,30,52,0.97)';
    roundRect(ctx, x, y, w, h, 12);
    ctx.fill();
    ctx.strokeStyle = branchColour(entry.branch);
    ctx.lineWidth = 2;
    roundRect(ctx, x, y, w, h, 12);
    ctx.stroke();
    ctx.fillStyle = branchColour(entry.branch);
    ctx.font = '700 12px system-ui, sans-serif';
    ctx.fillText(entry.branch.toUpperCase(), x + w / 2, y + 26);
    ctx.fillStyle = '#fff6d8';
    ctx.font = '700 19px Georgia, serif';
    ctx.fillText(entry.name, x + w / 2, y + 56);
    ctx.fillStyle = 'rgba(244,236,216,0.88)';
    ctx.font = '14px system-ui, sans-serif';
    ctx.fillText(entry.text, x + w / 2, y + 86);
    ctx.fillStyle = 'rgba(201,184,255,0.9)';
    ctx.font = '12.5px system-ui, sans-serif';
    ctx.fillText(`Level ${world.tree[entry.id]} of ${entry.max}`, x + w / 2, y + 118);
    world.uiRegions.push({ x, y, w, h, action: 'offer', data: entry });
    x += w + gap;
  }
  ctx.textAlign = 'left';
}

/** Card edge colour per spectrum branch. */
function branchColour(branch) {
  switch (branch) {
    case 'Ember': return '#ff7a3c';
    case 'Gilded': return '#ffc93c';
    case 'Umbral': return '#9a6bff';
    case 'Heart': return '#ff8fb5';
    default: return '#7fd4ff';
  }
}

/** The pause veil. */
function drawPause(ctx, world, input) {
  veil(ctx, 0.55);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffe9a8';
  ctx.font = '700 44px Georgia, serif';
  ctx.fillText('The Noon Holds Its Breath', FIELD.width / 2, 330);
  ctx.fillStyle = 'rgba(244,236,216,0.85)';
  ctx.font = '15.5px system-ui, sans-serif';
  ctx.fillText('Mirrors keep their angles. The shades keep their hunger.', FIELD.width / 2, 372);
  registerButton(ctx, world, FIELD.width / 2 - 190, 420, 176, 48, 'Resume', 'pause', input, true);
  registerButton(ctx, world, FIELD.width / 2 + 14, 420, 176, 48, 'Restart Run', 'restart', input, false);
  ctx.textAlign = 'left';
}

/** Game over and victory share a panel: result, tallies, ways onward. */
function drawEndPanel(ctx, world, input, victory) {
  veil(ctx, 0.62);
  ctx.textAlign = 'center';
  ctx.fillStyle = victory ? '#ffe9a8' : '#ff9a8f';
  ctx.font = '700 52px Georgia, serif';
  ctx.fillText(victory ? 'THE CRYSTAL HOLDS' : 'THE LIGHT GOES OUT', FIELD.width / 2, 268);
  ctx.fillStyle = 'rgba(244,236,216,0.92)';
  ctx.font = '17px system-ui, sans-serif';
  ctx.fillText(
    victory
      ? 'Forty waves broke against your glass, and the noon is yours.'
      : `The shades reached the Heart Crystal on wave ${world.wave}.`,
    FIELD.width / 2, 312,
  );
  const rows = [
    ['Waves survived', `${victory ? 40 : world.wave - (world.director.phase === 'build' ? 1 : 0)}`],
    ['Shades burned', `${world.stats.kills}`],
    ['Gold earned', `${world.stats.earned}`],
    ['Final score', `${world.score}`],
  ];
  let y = 366;
  ctx.font = '15.5px system-ui, sans-serif';
  for (const [label, value] of rows) {
    ctx.fillStyle = 'rgba(244,236,216,0.65)';
    ctx.textAlign = 'right';
    ctx.fillText(label, FIELD.width / 2 - 16, y);
    ctx.fillStyle = '#fff6d8';
    ctx.textAlign = 'left';
    ctx.fillText(value, FIELD.width / 2 + 16, y);
    y += 28;
  }
  ctx.textAlign = 'center';
  if (victory) {
    registerButton(ctx, world, FIELD.width / 2 - 200, 512, 190, 52, 'Endless Noon ∞', 'endless', input, true);
    registerButton(ctx, world, FIELD.width / 2 + 10, 512, 190, 52, 'New Run', 'restart', input, false);
  } else {
    registerButton(ctx, world, FIELD.width / 2 - 100, 512, 200, 52, 'Try Again', 'restart', input, true);
  }
  ctx.textAlign = 'left';
}

/** A translucent dark veil over the scene. */
function veil(ctx, alpha) {
  ctx.fillStyle = `rgba(6,5,12,${alpha})`;
  ctx.fillRect(0, 0, FIELD.width, FIELD.height);
}

/** Dispatch a click at logical (x, y). Returns true when it was consumed. */
export function handleClick(world, x, y) {
  world.audio?.unlock();
  // Regions were registered back-to-front; the last drawn is on top.
  for (let i = world.uiRegions.length - 1; i >= 0; i -= 1) {
    const region = world.uiRegions[i];
    if (x >= region.x && x <= region.x + region.w && y >= region.y && y <= region.y + region.h) {
      runAction(world, region.action, region.data);
      return true;
    }
  }
  if (world.screen !== 'play' || world.paused) return false;

  // Field clicks: build on a pad, or select standing glass.
  for (const pad of world.island.pads) {
    if (distance({ x, y }, pad) < 24) {
      if (pad.tower) {
        world.selected = pad.tower;
        world.buildKind = null;
        world.audio?.click();
        return true;
      }
      if (world.buildKind) {
        const tower = buildTower(world, world.buildKind, pad);
        if (tower) {
          world.selected = tower;
          if (tower.kind !== 'mirror' && tower.kind !== 'shard') world.buildKind = world.gold >= buildCost(world, tower.kind) ? world.buildKind : null;
        } else {
          world.audio?.error();
        }
        return true;
      }
      return true;
    }
  }
  for (const tower of world.towers) {
    if (distance({ x, y }, tower) < tower.radius + 7) {
      world.selected = tower;
      world.buildKind = null;
      world.audio?.click();
      return true;
    }
  }
  world.selected = null;
  return false;
}

/** Run one UI action by name. */
function runAction(world, action, data) {
  switch (action) {
    case 'start':
    case 'restart':
      startRun(world);
      break;
    case 'endless':
      enterEndless(world);
      break;
    case 'pause':
      world.paused = !world.paused;
      world.audio?.click();
      break;
    case 'speed':
      world.speed = world.speed === 1 ? 2 : world.speed === 2 ? 3 : 1;
      if (world.save) {
        world.save.speed = world.speed;
        storeSave(world.save);
      }
      break;
    case 'mute':
      if (world.audio) {
        world.audio.toggleMute();
        if (world.save) {
          world.save.muted = world.audio.muted;
          storeSave(world.save);
        }
      }
      break;
    case 'buildKind':
      world.buildKind = world.buildKind === data ? null : data;
      world.selected = null;
      world.audio?.click();
      break;
    case 'callWave':
      callWave(world);
      break;
    case 'upgrade':
      if (world.selected) upgradeTower(world, world.selected);
      break;
    case 'sell':
      if (world.selected) sellTower(world, world.selected);
      break;
    case 'offer':
      takeOffer(world, data);
      break;
    default:
      break;
  }
}

/** Handle one key press (lowercase key name) for the current screen. */
export function handleKey(world, key) {
  world.audio?.unlock();
  if (key === 'm') {
    runAction(world, 'mute');
    return;
  }
  if (world.screen === 'title') {
    if (key === ' ' || key === 'enter') startRun(world);
    return;
  }
  if (world.screen === 'over' || world.screen === 'victory') {
    if (key === ' ' || key === 'enter' || key === 'r') startRun(world);
    return;
  }
  switch (key) {
    case 'p':
    case 'escape':
      if (world.selected && key === 'escape') world.selected = null;
      else world.paused = !world.paused;
      break;
    case ' ':
      if (!world.paused && !world.offer) callWave(world);
      break;
    case 'q':
      if (world.selected) { rotateTower(world.selected, -Math.PI / 36); world.audio?.rotate(); }
      break;
    case 'e':
      if (world.selected) { rotateTower(world.selected, Math.PI / 36); world.audio?.rotate(); }
      break;
    case 'u':
      if (world.selected) upgradeTower(world, world.selected);
      break;
    case 'x':
      if (world.selected) sellTower(world, world.selected);
      break;
    default: {
      const kind = Object.keys(TOWERS).find((k) => TOWERS[k].key === key);
      if (kind) {
        world.buildKind = world.buildKind === kind ? null : kind;
        world.selected = null;
        world.audio?.click();
      }
      break;
    }
  }
}

/** Per-frame held-key and wheel aiming for the selected tower. */
export function applyAimKeys(world, input, frame) {
  const tower = world.selected;
  if (!tower || world.screen !== 'play') return;
  if (tower.kind !== 'mirror' && tower.kind !== 'shard') return;
  if (input.held('q')) rotateTower(tower, -0.028);
  if (input.held('e')) rotateTower(tower, 0.028);
  if (frame.wheel) {
    rotateTower(tower, frame.wheel * (Math.PI / 30));
    world.audio?.rotate();
  }
}
