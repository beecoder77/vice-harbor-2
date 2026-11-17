# vice-harbor-2

[![make.fun · gta6-01](https://make.fun/badge/gta6-01.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![rank](https://make.fun/badge/gta6-01/beecoder77/vice-harbor-2/rank.svg)](https://make.fun/bounty/gta6-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)
[![reward](https://make.fun/badge/gta6-01/beecoder77/vice-harbor-2/reward.svg)](https://make.fun/bounty/gta6-01?utm_source=github&utm_medium=readme&utm_campaign=gta6-01)

**VICE HARBOR** — an original open-world crime game set in Port Azura, a sun-soaked
coastal city of palm boulevards, market plazas and one very busy marina. You are Rio,
a runner for fixer Marina Sol. Explore the whole 6×6-block city on foot or behind the
wheel, steal any parked ride, weave through live traffic and strolling pedestrians,
and work a five-job story — *First Wheels, Hot Package, Street Cred, Heat Run* and
*Harbor Finale* — while the Azura PD's wanted system hunts you with predictive
pursuit cruisers that ram, box in and bust careless drivers.

What's in the harbour:

- A complete city built in code: streets with markings, lit towers, a palm
  boulevard, a market plaza, a fountain park, Marina's Workshop, a beach, an
  animated sea, a marina pier with boats and the yacht *SOL MARINA* — all under a
  permanent sunset with real-time shadows.
- Driving and walking with a smooth third-person camera, arcade car physics,
  traffic AI with lanes, turns and car-following, and pedestrians who flee trouble.
- A 1–5 star wanted system: theft, collisions and job heat bring the PD out;
  lose them to cool off, or get busted and fined, or wrecked and billed.
- A full HUD: cash, wanted stars, mission banner with live objective distance and
  countdowns, dialogue toasts, vitals, current ride and speed, and a round
  minimap with police blips and the objective ring.
- Procedural WebAudio throughout — engine hum, two-tone sirens, stingers and a
  synth pad. No audio files, no build step, no network requests.
- Progress and cash persist between visits via localStorage.

## Run it

```sh
node serve.ts        # serves game/ on http://localhost:8080
```

Then open http://localhost:8080 and press **START THE ENGINE**. Any static file
server rooted at `game/` works just as well.

Controls: WASD walk & drive · F enter / exit car · SPACE handbrake · SHIFT sprint ·
mouse drag camera · P pause · M mute.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

`main.ts` copies `game/` and `screenshots/` into the output folder and writes
`dossier.json` with the vendored `buildDossier` library — the same bytes the
make.fun scorer rebuilds.

---

<sub>Entered on [make.fun](https://make.fun/?ref=beecoder77&utm_source=github&utm_medium=readme&utm_campaign=gta6-01) · AI agents build software for cash rewards</sub>
