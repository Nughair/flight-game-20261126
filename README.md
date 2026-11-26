# Duskwing Post — Golden-Hour Air Mail

An original 3D flight game that runs offline in a desktop browser from
static files. You fly the **Wren D-4 “Duskwing”**, a high-wing bush
aeroplane, on the evening post round over the Sora Archipelago: seven
islands in a warm sea, one grass strip, and the last hour of light.

**The campaign** is three sorties, flown in order, with one score and one
airframe shared between them:

1. **The Ring Run** — thread six gold gates over the islands, in order,
   then come home and land.
2. **The Mail Run** — carry a parcel to each of three villages and drop
   it by parachute onto their orange circles; the wind drifts the fall.
3. **The Storm Run** — fly medicine to the North Rock lighthouse, then
   ride a gusting crosswind home on short fuel and land.

Fuel burns faster at full throttle, rough arrivals cost hull, and hull
carries from sortie to sortie (the ground crew patches her up between
flights, at a price). There is also a **free flight** mode with an
endless gate course. The flight model stalls, bleeds speed in steep
banks, and judges every landing — silky, firm, rough, or worse.

## Play it

```
node serve.ts            # then open http://localhost:8080
```

Node 22, no build step, no network: everything the game loads sits under
`game/`. It also plays straight from the hosted entry page.

**Controls** — W/S or ↑/↓ pitch · A/D or ←/→ bank · R/F throttle ·
Space drops the mail · B brakes · P pause · M sound. The mouse flies
too: the pointer's offset from centre is where the nose goes.

## How it is built

The whole world is drawn by a small software 3D projector written for
this game — projected polygons, painter-sorted, flat-shaded in one
golden-hour palette. Terrain is a single analytic height function shared
by the renderer, the flight model and the landing judge, so what you
see is exactly what you can hit. Sound is synthesized WebAudio (engine,
wind, chimes, thuds); there are no asset files at all.

| File | Its one job |
|---|---|
| `game/src/config.js` | Constants: palette, flight tuning, the words |
| `game/src/random.js` | Seeded RNG and value noise |
| `game/src/world.js` | The archipelago: islands, strip, gates, villages, props |
| `game/src/flight.js` | The flight model and its touchdown/crash events |
| `game/src/input.js` | Keyboard and mouse |
| `game/src/render.js` | The projector: sky, terrain, sea, props, rings |
| `game/src/plane.js` | The Wren D-4's polygon model |
| `game/src/instruments.js` | Steam gauges, HUD, objective diamond |
| `game/src/missions.js` | Sorties, parcels, fuel, landing grades, scoring |
| `game/src/audio.js` | Synthesized engine, wind and event sounds |
| `game/src/ui.js` | Title, briefings, debriefs, the campaign ledger |
| `game/src/shots.js` | `?shot=` staging used to take the entry screenshots |
| `game/src/main.js` | The state machine and the clock |
| `main.ts` | The hand-in: copies `game/` + `screenshots/` to the output and writes `dossier.json` |
| `vendor/makefun-game.ts` | The make.fun dossier library, copied from the kit unchanged |

## Hand it in

```
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

Screenshots in `screenshots/` are real renders of the game itself, taken
from the staged scenes listed in `shots.json` (the game poses an honest
moment of a sortie; the renderer draws it exactly as in play).

MIT licensed — see `LICENSE`.
