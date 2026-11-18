// Boot and the main loop: wire the modules together and run the game.
//
// A fixed-step simulation (120 steps a second of game time at 1x, scaled
// by the speed toggle) keeps the optics and the shades deterministic at
// any refresh rate; rendering happens once per animation frame. The
// screenshot scenes (?shot=...) are installed before the loop starts, so
// a shot is a real frame of the real game, frozen mid-action.

import { FIELD, STEP } from './config.js';
import { makeAudio } from './audio.js';
import { loadSave } from './save.js';
import { makeInput } from './input.js';
import { makeWorld, stepWorld } from './world.js';
import { drawScene } from './render.js';
import { drawScreens, handleClick, handleKey, applyAimKeys } from './screens.js';
import { installShotScene } from './shots.js';

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const audio = makeAudio();
const save = loadSave();
if (save.muted) audio.toggleMute();
const world = makeWorld(audio, save);
const input = makeInput(canvas);

installShotScene(world, new URLSearchParams(window.location.search));

// A small handle for debugging and for the screenshot harness: the live
// world, nothing more. Harmless in play; handy in a console.
window.__heliodrome = world;

// Keys the screens care about, dispatched once per press (not per frame).
const handledKeys = new Set();
function pollKeys() {
  for (const key of input.keys) {
    if (!handledKeys.has(key)) {
      handledKeys.add(key);
      handleKey(world, key === ' ' ? ' ' : key);
    }
  }
  for (const key of [...handledKeys]) {
    if (!input.keys.has(key)) handledKeys.delete(key);
  }
}

let last = performance.now();
let accumulator = 0;

function frame(now) {
  requestAnimationFrame(frame);
  let elapsed = Math.min(0.1, (now - last) / 1000);
  last = now;
  const shotMode = world.shotMode === true;

  pollKeys();
  const frameInput = input.takeFrame();
  if (frameInput.clicked && !shotMode) handleClick(world, frameInput.clicked.x, frameInput.clicked.y);
  applyAimKeys(world, input, frameInput);

  if (!shotMode) {
    accumulator += elapsed * world.speed;
    let steps = 0;
    while (accumulator >= STEP && steps < 12) {
      stepWorld(world, STEP);
      accumulator -= STEP;
      steps += 1;
    }
    if (steps === 12) accumulator = 0;
  }

  const scale = input.view.scale;
  const ctx = canvas.getContext('2d');
  ctx.setTransform(window.devicePixelRatio * scale, 0, 0, window.devicePixelRatio * scale, input.view.ox * window.devicePixelRatio, input.view.oy * window.devicePixelRatio);
  ctx.fillStyle = '#07060d';
  ctx.fillRect(-input.view.ox / scale, -input.view.oy / scale, FIELD.width + input.view.ox * 2 / scale, FIELD.height + input.view.oy * 2 / scale);
  drawScene(ctx, world, input);
  drawScreens(ctx, world, input);

  if (status) {
    const line = world.screen === 'play'
      ? `Wave ${world.wave}. Gold ${world.gold}. Lives ${world.lives}. ${world.enemies.filter((e) => e.alive).length} shades on the road.`
      : `HELIODROME. Screen: ${world.screen}.`;
    if (status.textContent !== line) status.textContent = line;
  }
}

requestAnimationFrame(frame);
