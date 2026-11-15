# Abandoned but not Forgotten — handoff

Challenge: NASA hackathon "Abandoned but not Forgotten: Storytelling about NASA's Discarded Equipment on the Moon and Mars". Audience: school-age + casual space fans. Site language: English. Accuracy matters.

## What it is now (v2)
One continuous universe in real time, on a flat screen **or in any WebXR headset** (Quest, Pico, Vive, Index, Vision Pro…). No build step.

1. **Orbit hub**: you float 20,000 km above Earth. Real star sky (NASA Deep Star Maps), the real Sun for today, Earth rotated to the current UTC time. **The Sun, the Moon and all planets are labelled in their real directions today** (`src/solar.js`, circular-orbit approximation; planets drawn enlarged, the label says by how much) with the ecliptic as a faint line. Five mission cards in an arc.
2. **Launch** (`src/rockets.js`): blink to 70 km above Cape Canaveral **on the real launch date and time** (Earth's day/night and the Sun are set to that moment, so Pathfinder and Opportunity launch at night). You fly beside the real rocket and watch it come apart: Saturn V (S-IC, LES jettison, S-II, S-IVB, TLI, SLA panels open, CSM transposition and docking, Eagle pulled free), Delta II 7925 / 7925H (6+3 GEM boosters, fairing, Star 48 spin-up), Atlas V 541 (4 solids, fairing, Centaur 2 burns), Titan IIIE/Centaur (solids light first, core air-lit, shroud, Centaur, Voyager's own kick motor). Captions name each event; plumes match the propellant (bright kerosene and solids, almost invisible hydrogen). Desktop gets camera shake; VR never does.
3. **Cruise**: the spacecraft that separated flies with you (`src/vehicles.js`). Warp streaks, big story text sliding in on alternating sides, a mission clock running from launch day to arrival day (Voyager counts the years up to today), FOV kick on desktop. Distances are real; time is compressed.
4. **Arrival, at 1:1 scale** next to the hardware (same as before).
5. **From Voyager 1**: look at THE SUN or EARTH for 2 s (a red ring fills) or point at the label, and you fly there at warp, with a fact card on arrival and "Back to Voyager 1" / "Back to orbit".

Sound is procedural (`src/audio.js`): rumble with thrust, thumps at staging, warp wind. M or the top-right button mutes.

The sky orientation on each surface is computed from the site latitude, the body's rotation pole and the Sun's position on the event date (`src/astro.js`), so the Milky Way sits where it really would.

## Design system & branding
- Follows NASA's Horizon Design System web typefaces: **Inter** (headings), **Public Sans** (body), **DM Mono** (labels/numbers), with NASA blue `#0B3D91` and NASA red `#FC3D21` (buttons, progress bar).
- **NASA logo: not included, on purpose** (the team decided not to request permission). NASA's brand guidelines say the insignia ("meatball"), logotype ("worm") and seal "may not be used for any purpose without explicit permission" and not on pages that are not NASA-sponsored. A logo slot is ready: put the approved file in `assets/brand/` and set `BRAND.logo` in `src/brand.js`. It then appears on the start screen and above the title in orbit. Ways to get one: ask agency-brand@mail.nasa.gov, apply for the **NASA Data Insignia** (for products using NASA data: https://www.nasa.gov/request-to-use-nasa-data-insignia/), or use whatever logo your hackathon's own rules allow.
- The NASA data disclaimer text is shown on the start screen (`BRAND.disclaimer`).

## Files
- `index.html`: shell, loader, import map (three@0.170.0 from jsDelivr).
- `src/main.js`: renderer, XR, input (mouse/touch/controllers/hands/gaze), hub, flight, arrival, state machine.
- `src/space.js`: Earth shader, atmospheres, Moon, Mars, Sun, floating-origin universe.
- `src/surface.js`: terrain, rocks, Mars sky, procedural hardware, per-site scenes.
- `src/missions.js`: **all story text and facts**.
- `src/astro.js`: Sun/Moon/Mars positions, sidereal time, frame alignment.
- `src/ui.js`: canvas-texture panels (same UI on screen and in VR), theme colours/fonts.
- `src/vehicles.js`: the cruise spacecraft for each mission.
- `src/rockets.js`: launch vehicles + staging timelines.
- `src/solar.js`: planets/Sun/Moon labels and ecliptic around the hub.
- `src/audio.js`: procedural sound.
- `src/brand.js`: logo slot + NASA data disclaimer.
- `tools/shot.mjs`: headless screenshot + console log (`node tools/shot.mjs "http://127.0.0.1:8642/?fly=eagle&t=14" out.png`).
- `assets/`: processed textures and models (33 MB). `_src_assets/`: raw NASA downloads (git-ignored, can be deleted).
- `prototype-v1.html`: the old 2D prototype.

## Run
```
python3 -m http.server 8642      # then open http://localhost:8642
```
Shortcuts: `?start`, `?go=eagle|sojourner|opportunity|ingenuity|voyager`, `?go=voyager&trip=sun|earth`, `?fly=<id>&t=<seconds>`, `?yaw=<deg>&pitch=<deg>`.

**On a headset**: WebXR needs HTTPS. Easiest: publish on GitHub Pages and open the URL in the headset's browser. Quest over USB: `adb reverse tcp:8642 tcp:8642` and open `http://localhost:8642` in the Quest Browser.

## Tested
Headless Chrome (SwiftShader): hub, Moon flight, all 5 arrival scenes render without errors. **Not yet tested on a real headset**: check FPS on Quest (72 fps target), controller rays, hand pinch and the 8K sky's memory use.

## Fact check (changes vs. v1)
Sojourner 10.6 kg (NASA figure); Eagle's fuel line rewritten as Mission Control's "30 seconds" call-out; "Light as a feather" became "Built light"; added that only the descent stage remains and that the flag was knocked over (Aldrin); Ingenuity rests at Valinor Hills, with the blade piece ~15 m away; Opportunity rests in Perseverance Valley. Still verify everything in `missions.js` against NASA pages before submitting.

## Next steps
1. Test on the Quest 3, then tune performance (shadow map size, foveation, 4K sky fallback).
2. Real terrain: LRO NAC DTM for Tranquility Base, HiRISE DTMs for Jezero / Meridiani / Ares Vallis.
3. Audio: Apollo 11 air-to-ground (public domain), Ingenuity's recorded sound, ambient.
4. Better Sojourner (no NASA glTF exists; consider modelling one in Blender).
5. Check the hackathon rules (the project may need to be built during the event).

## Surface animations (2026-11-14)
Historical replay now starts on arrival for Eagle, Sojourner, Opportunity and Ingenuity. Includes descent/staging, airbag landing and deployment, rover driving, Perseverance sky crane and Ingenuity first flight. Pause/resume, replay, resting-site and orbit controls are provided on screen and as world-space VR panels. The spectator camera does not move automatically. Voyager is unchanged.

See MOTION_SOURCES.md for source trails and the intentionally illustrative geometry, terrain, routes and timing. New files: src/playback.js, src/surface-motion.js and src/motion-controls.js. Test scene timing with ?go=<id>&motion=<seconds>. Headset validation remains pending.

## Reviewer feedback round (2026-11-15)
- **Legibility**: every text panel has a dark backing (`plate()` / `textShadow()` in `src/ui.js`); flight text draws above the models.
- **Pace**: Automatic or Step by step (start screen, top bar, hub button in VR, `P` key, `?pace=step|auto`; remembered per browser). Step mode holds before each launch event, each cruise chapter, arrival, and each stage of the surface reconstruction (`src/pace.js`, `src/playback.js`).
- **Extended reading**: "Read more on NASA.gov" on every arrival, with checked NASA / NSSDCA / ALSJ links and a QR to continue on a phone; a QR card in VR (`src/read-more.js`).
- **Offline museum**: `museo.html` prints one QR card per mission. `node tools/offline-pack.mjs` (once, with internet) copies three.js, the QR library and the fonts into `vendor/`; `node tools/serve.cjs --lan` (or `iniciar.cmd --lan`) then serves phones on the same Wi-Fi with no internet. In offline mode WebXR controller/hand models (fetched from a CDN by three.js) are not available; the experience itself works. Phones and tablets load the 4K sky.
- **Ingenuity**: Perseverance now drives nose-first.
- Competition logos: still to check against the hackathon rules (team decision).
