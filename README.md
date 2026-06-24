# 🏛 THE MANSION

A walkable **3D building** — a blended **Roman / Victorian** mansion (veined marble floors, fluted
columns, round arches, coffered ceilings, crystal chandeliers, damask walls, velvet drapery, urns,
frescoes) — where you physically walk (WASD, real wall collision) through doorways into **enclosed
rooms**, and each room's display opens a different *experimental website*: pages that tear in half,
shatter into glass, burn into ash, dissolve into sand, inflate until they pop, fight back, flee from
your cursor, race you around the world, judge your mouse control, or fold through the fourth dimension.

**75 rooms in total:** 74 hand-built experiences off the galleries + a grand cinematic finale,
*The Architect's Chamber*. Interacting with a room **cinematically flies you in** before the site
takes over. Rendering uses image-based lighting (`RoomEnvironment`), ACES tone-mapping, custom GLSL
(marble, GLSL dust motes, waving velvet drapery) and a post stack of **SSAO + Bloom + Depth-of-Field
+ SMAA**. Many sites now have **procedural Web-Audio sound** (`experiences/_sound.js`) — a distinct
sonic signature each (glass shatter, fire crackle, paper rip, zipper teeth, real Morse beeps, …).

There are two builds: the runnable vanilla-Three.js mansion (this folder) and a Next.js +
React-Three-Fiber + Rapier scaffold in [`mansion-next/`](mansion-next/) (the framework-stack version).

![rooms](https://img.shields.io/badge/rooms-75-7af0ff) ![built with](https://img.shields.io/badge/three.js-r160-a06bff) ![deps](https://img.shields.io/badge/runtime%20deps-0-1dd1a1)

---

## ▶ Run it

It must be served over HTTP (ES modules + import maps don't work from `file://`).

```bash
# option A — the built-in zero-dependency server
node serve.js                 # → http://localhost:8080

# option B — anything else
python -m http.server 8080
npx serve .
```

Then open **http://localhost:8080** and click **Enter the Mansion**.

> Three.js is loaded from a CDN (unpkg) via an import map, so the hub and the WebGL rooms need a
> network connection the first time. Everything else is fully local.

## 🎮 Controls (the hub)

| Key | Action |
|-----|--------|
| `W A S D` / arrows | Move |
| Mouse | Look around (click the scene to capture the cursor) |
| `Shift` | Sprint |
| `E` or `Click` | Enter the room you're standing in front of |
| `Tab` | Open the **room directory** — search all 75 rooms and jump to any one |
| Click the **minimap** | Teleport to the nearest room |
| `M` | Toggle minimap |
| `Esc` | Release cursor / close a panel / leave a room |

Walk forward through the grid of portals; the glowing **gold dais at the very back** is the finale.
Your explored count is tracked, and the finale reacts to how many rooms you actually opened.

---

## 🗂 What's inside

```
index.html            the 3D mansion hub (Three.js, first-person, bloom)
serve.js              tiny static server (no deps)
css/hub.css           hub styling
js/registry.js        the catalog of all 75 rooms
js/hub.js             the building: procedural floor plan, PBR materials, IBL, wall
                      collision, gallery navigation, minimap, directory, finale chamber
experiences/          one self-contained HTML file per room
  _shared.css/.js     helpers + the fake-article generator the effects decorate
  _sound.js           zero-asset procedural Web-Audio toolkit (MXA) for per-site sound
  finale.html         The Architect's Chamber (the ending)
mansion-next/         Next.js + R3F + Rapier + postprocessing + Zustand scaffold (see its README)
test/smoke.js         headless smoke test — loads every page, fails on JS errors
```

Each experience is a **standalone HTML file**. Want to add a room? Drop a file in `experiences/`,
add one line to the `FLAGSHIP` array in `js/registry.js`, done.

## 🧪 The 74 experiences

**Physical DOM effects** — Tearable DOM · Glass Shatter · The Looming Shadow · Burning Paper ·
Magnifying Burn · Inflatable Divs · Sand Clock DOM · The Zipper · The Breathing Site ·
The De-constructor · Marquee Singularity

**WebGL / 3D** — The Glitch Dimension · 4D Hypercube UI · Code City 3D · Internet Traffic Simulator ·
The Final Boss Website · Generative Conspiracy Map · Browser Fingerprint Art · Dream Interpreter DOM ·
The Traceroute Highway

**The page is a game** — Div-Eating Snake · Breakout DOM · Z-Index Ocean · DOM Jenga ·
Scrollbar Labyrinth · The Physics Volume Slider · Terms of Service Speedrun · The Sniper UI ·
The Boids Navigation · Pathfinding Unsubscribe · Magnifying Glass UI · The HTTP Status Dungeon ·
Console.log() Adventure · The Honeypot Simulator · The RSA Puzzle Box

**AI / backend behaviour** — The Mirror Site · Auto-Translating Chaos · Nostalgia Engine ·
Reverse Search · The Deceptive Scrollbar · Read-Mind Predictor · Time-Travel History ·
The API Blackhole · The 1ms Latency Challenge · Dark Web Crawler · The Quantum Randomizer ·
The Turing Test Chatbot · The Hallucinating Encyclopedia · Subreddit Simulator Live ·
The Sentient Database · The Polyglot Server · Prompt-Injected E-Commerce · The Evolving Dialect

**Adversarial / weird-web** — The Schizophrenic Nav · The Sentient 404 · Desktop Simulator ·
The Endless Staircase · The Blackout · The Cult Initiation · The Blockchain Labyrinth ·
The Roulette Checkout · The Impatient Shopping Cart · The Judging AI Cursor · Procedural GeoCities ·
The Code Execution Sandbox · The Server Temperature UI · The 7-Month Mars Ping · The Bribe ·
Password Is the Page · Tab Title Morse Code · The Decoy UI · The Base64 URL ·
The Password Typo Requirement · Steganography Gallery

## 🔌 "Real" vs "simulated"

Many of the original ideas demanded a backend, live scraping, paid APIs, or model inference. With no
server and no API keys, those are built as **faithful client-side simulations** that capture the
*feel* (e.g. the Quantum Randomizer tries a real quantum-RNG endpoint and falls back to
`crypto.getRandomValues`; the Polyglot Server fakes each language's JSON idioms; the Hallucinating
Encyclopedia generates its fakes procedurally). The purely-client ideas — shatter, tear, burn,
snake, breakout, bullet-hell, the tesseract, the loupe, etc. — are the real thing.

A few rooms genuinely use your machine: **Browser Fingerprint Art** seeds a 3D sculpture from your
real GPU/fonts/UA; **The Bribe** runs an actual SHA-256 proof-of-work; **The RSA Puzzle Box** does
real (tiny) RSA math.

## ✅ Verification

```bash
npm test     # serves the project, opens every page in headless Chrome, fails on any JS/console error
```

The smoke test uses `puppeteer-core` driving an installed Chrome/Edge (it does **not** download
Chromium). All 76 pages currently pass clean.

---

*Built as one big creative sprint. Open every door. The last one is worth it.*
