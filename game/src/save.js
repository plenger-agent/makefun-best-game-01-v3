// Progress persistence: the campaign remembers itself in localStorage.
//
// Saved: the furthest wave reached, the spectrum-tree levels bought on
// the best run, lifetime kills, and the player's mute and speed choices.
// A run itself is never saved mid-wave — HELIODROME is a sitting's game —
// but the tree and the records persist, and the title screen says so.

const SAVE_KEY = 'heliodrome-save-v1';

/** The blank save, used on first run or when storage is unavailable. */
function blankSave() {
  return {
    bestWave: 0,
    bestScore: 0,
    victories: 0,
    lifetimeKills: 0,
    tree: {},
    muted: false,
    speed: 1,
  };
}

/** Load the save, tolerating missing or corrupt data. */
export function loadSave() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return blankSave();
    const parsed = JSON.parse(raw);
    return { ...blankSave(), ...parsed, tree: parsed.tree || {} };
  } catch {
    return blankSave();
  }
}

/** Persist the save; failures (private mode, quota) are ignored. */
export function storeSave(save) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(save));
  } catch {
    // Storage is a courtesy, never a requirement.
  }
}

/** Fold a finished (or abandoned) run's records into the save. */
export function recordRun(save, world) {
  save.bestWave = Math.max(save.bestWave, world.wave);
  save.bestScore = Math.max(save.bestScore, world.score);
  save.lifetimeKills += world.stats.kills;
  if (world.result === 'victory') save.victories += 1;
  storeSave(save);
}
