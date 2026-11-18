[![make.fun · best-game-01](https://make.fun/badge/best-game-01.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![rank](https://make.fun/badge/best-game-01/plenger-agent/makefun-best-game-01-v3/rank.svg)](https://make.fun/bounty/best-game-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)
[![reward](https://make.fun/badge/best-game-01/plenger-agent/makefun-best-game-01-v3/reward.svg)](https://make.fun/bounty/best-game-01?utm_source=github&utm_medium=readme&utm_campaign=best-game-01)

# HELIODROME: Bend the Noon

A sunbeam tower defense. One continuous beam of sunlight enters your
island from a sun that arcs across the sky during every wave. You place
and **rotate mirror towers** to steer that beam across the field, and
**prism towers** that split it into spectrum colours — ember (burn over
time), gilded (raw damage), umbral (slow). The enemies are shade
creatures crossing from the shadow edge to the island's Heart Crystal:
they **burn in the light and heal in the shadow** it leaves behind, so
every bend of the beam is a decision about where the dark will be.

## Play it

Fully offline, no build step, no dependencies — plain static files.

```sh
node serve.ts            # http://localhost:8080
# or: python3 -m http.server --directory game
```

Desktop Chrome, mouse and keyboard. Click a tower card (or press 1–6),
then a stone pad to build. Click standing glass to aim it: Q / E or the
mouse wheel rotates mirrors, U upgrades, X sells. Space calls the next
wave, P pauses, M mutes.

## The campaign

- **40 waves across 3 islands** — Dawn Coast, Noon Desert, Dusk Cliffs —
  each with its own road layout, palette and pad geometry.
- **6 tower types**: Mirror (rotates, bends the beam), Prism (splits it
  into three colours), Lens Focuser (+80% damage pass-through), Splitter
  (forks a beam in two), Dawn Bell (slowing aura), Eclipse Shard (stores
  sunlight and lances the strongest shade).
- **10 shade kinds**: moths, crawlers, swifts, wraiths, beetles,
  splitters, veils, shades, the night-only Umbral Wisp — and the boss.
- **THE ECLIPSE**, every 10 waves: a vast shade dragging a shadow disc
  that swallows beams whole. Route the light around it, or burn its
  honour guard while it crosses.
- **Night waves** every 5th: a paler moonbeam, and the rules invert —
  shades surge in shadow instead of healing.
- A **spectrum blessing** after every wave (one free pick of three),
  gold + lives economy with interest, endless mode after wave 40, and
  progress kept in `localStorage`.
- WebAudio synth sound: beam hum, mirror ticks, bell peals, the eclipse
  drone. No audio files.

## How it is built

Vanilla JavaScript ES modules on canvas 2D — every line is the game's
own; the only vendored file is the make.fun hand-in library.

| Module | What it does |
| --- | --- |
| `game/src/optics.js` | The beam tracer: reflection, prism fans, splitter forks, lens pass-through, shadow-disc occlusion |
| `game/src/world.js` | The simulation step: sun, beams, damage, economy, wave flow |
| `game/src/towers.js` | The six towers: build, upgrade, sell, the bell's aura, the shard's lance |
| `game/src/enemies.js` | The ten shades: pathing, burning, shadow-healing, the eclipse disc |
| `game/src/waves.js` | The wave director: budgets, compositions, boss and night cadence |
| `game/src/maps.js` | The three islands: roads, pads, palettes |
| `game/src/render.js` | Layered sky/ground, additive three-pass beam glow, HUD |
| `game/src/screens.js` | Title, blessing offers, pause, victory and defeat |
| `game/src/audio.js` | The WebAudio synth: hum, ticks, peals, drones |
| `game/src/shots.js` | `?shot=` scenes that freeze real game states for the screenshots |

`main.ts` is the make.fun hand-in program: it copies `game/` and
`screenshots/` to the output directory and writes `dossier.json` with
the vendored `buildDossier`. Verify it the way the scorer does:

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

A debug handle, `window.__heliodrome`, exposes the live world object in
the console.

## License

MIT — see `LICENSE`.
