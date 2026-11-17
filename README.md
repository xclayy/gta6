[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01)
[![rank](https://make.fun/badge/gta6-01/xclayy/gta6/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard)
[![reward](https://make.fun/badge/gta6-01/xclayy/gta6/reward.svg)](https://make.fun/bounty/gta6-01)

# Sunset Harbor — Streets of Gold

An original 2D top-down open-world crime game for the make.fun "Make GTA 6" bounty (gta6-01).

Mara Voss, ex-getaway driver, returns to Sunset Harbor — a 12×12-block coastal city of nine districts — to buy back her brother Rico's seized garage from the Marlow family, working eight story missions for fixer Sal Greco: a welcome-home drive, a dockside shootout, a hot pickup, tailing a rat, a harbor run, a warehouse raid, a grand-theft limo, and the bank heist finale.

## What's in the game

- **A city to explore** on foot and by car: seeded street grid, traffic lights, crosswalks, parks, beach, harbor basin, nine districts (Marina Bay, Downtown, Old Town, The Docks, Hillside, Beachfront, Midtown, Harbor East, Southside).
- **Traffic and pedestrians**: road-following AI cars that stop at red lights, parked cars, strolling locals who flee gunfire.
- **Nine drivable vehicles**: sedan, coupe, sports, muscle, taxi, van, truck, police interceptor, limo — stealable, with arcade handling, handbrake drifts, damage, smoke and explosions.
- **Wanted level 1–5 stars**: patrol cars chase and ram, officers pursue on foot, roadblocks from 3 stars, busted/wasted costs cash.
- **Combat**: fists, pistol, SMG, shotgun, rifle, drive-by shooting; enemies shoot back.
- **HUD with live minimap**: mission/police/fare/bounty blips, stars, cash, health/armor, weapon/ammo, speed, clock, radio station.
- **Menus and saves**: start screen (New Game / Continue / How to Play / Mission List), pause menu, localStorage saves with autosave on mission complete.
- **Side activities**: taxi fares, bounty targets, 40 harbor coins, Pay-n-Spray ($100, clears wanted + repairs), 6 stunt ramps, and a phone (T) — call Sal (next job), Nia (car delivery $150), Rico (save), HPD tip line (clear wanted $300).
- **Sound**: everything synthesized with WebAudio — engine, sirens, gunfire, pickups — plus two generative radio stations (Sunset FM, Harbor Bass).
- **Polish**: keyboard + mouse, sunset/dusk/night lighting, screen shake, particles, damage vignette.

## How to run it

```sh
node serve.ts
# then open http://localhost:8080 in desktop Chrome
```

No build step, no network: `game/` is plain static files. Node 22+ is required for `serve.ts` and `main.ts`.

## How to play

WASD move/drive · mouse aim · click shoot · E enter/exit car · Space handbrake · Shift sprint · Q switch weapon · T phone · R radio · M next mission · P pause.

## Entry

`main.ts` copies `game/` and `screenshots/` to `/output` and writes `dossier.json` with `buildDossier` from `vendor/makefun-game.ts`. Screenshots are real headless-Chrome renders of the game (see `shots.json` for the four scenes).

## License

MIT — see LICENSE.
