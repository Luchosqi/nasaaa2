# Surface motion — historical reconstructions

Added 2026-11-14. Starting point: [Space Apps challenge resources](https://www.spaceappschallenge.org/2026/challenges/nasas-discarded-equipment-storytelling/?tab=resources).

## Sources and navigation trail

- **Eagle:** the challenge links to [Apollo 11 Lunar Module / NSSDCA](https://nssdc.gsfc.nasa.gov/nmc/spacecraft/display.action?id=1969-059C), and explicitly describes the descent stage left as a launch platform. Landing is July 20, 1969; the ascent stage departs July 21. This scene uses the existing NASA LM asset. The division into stages follows the existing prototype's mesh-height approximation, not an engineering assembly hierarchy.
- **Pathfinder / Sojourner:** the challenge links directly to [Mars Pathfinder](https://science.nasa.gov/mission/mars-pathfinder/). Its “Airbag Landing” and “Sojourner Rover” sections support parachute descent, airbags, petal deployment and rover departure. The page's “How We Land on Mars” navigation leads to the resource below.
- **Opportunity:** the challenge links directly to [Spirit and Opportunity](https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/). [How We Land on Mars](https://science.nasa.gov/planetary-science/programs/mars-exploration/mission-timeline/how-we-land-on-mars/) describes the shared Pathfinder/MER sequence: parachute, tether, braking rockets, airbags and rover deployment. Opportunity's historical landing is Eagle Crater; the resting scene is Perseverance Valley. The replay explicitly labels the historical location, and terrain is illustrative.
- **Ingenuity:** the challenge links directly to [Ingenuity](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/). The timeline distinguishes arrival Feb. 18, deployment April 3 and first flight April 19, 2021. Its first-flight link leads to [First Video of NASA's Ingenuity Mars Helicopter in Flight](https://science.nasa.gov/resource/first-video-of-nasas-ingenuity-mars-helicopter-in-flight/). The related “How We Land on Mars” page describes Perseverance's sky crane and cable release.

## What is represented

- Eagle: powered final descent, touchdown, an explicit time jump and ascent-stage departure. No rover is invented for Apollo 11.
- Pathfinder and Opportunity: final parachute descent, backshell braking, release, illustrative airbag bounces, deflation, petal opening and a short drive. Opportunity adds camera-head and instrument-arm movement.
- Ingenuity: Perseverance's final powered descent and three-cable sky crane, release and flyaway; a time jump to helicopter deployment and the first flight, including counter-rotating blades, hover, turn and landing. Earlier atmospheric entry and parachute phases are explicitly omitted.
- All sequences return to the existing stationary artifact scenes. They do not imply that grounded or inactive machines are operating today.

## Intentional simplifications

Time, approach paths, driving routes, rotor speed and terrain are illustrative, not telemetry or a physics simulation. Three bounces stand for the much longer real airbag sequence. Procedural landers and rovers are educational illustrations. The existing Opportunity asset is a single merged mesh; its replay uses a separate articulated illustration, while the resting scene retains the NASA model. Original assets are unchanged.

## Controls and testing

Arrival starts the replay automatically after the fade. Desktop/touch: Pause/Resume, Replay landing, Resting site, Back to orbit. VR exposes equivalent world-space controls. The spectator camera is not animated. A direct scene URL can pause at a point for inspection: `?go=opportunity&motion=28` (seconds). `?go=ingenuity&motion=48` opens its final state.

Real headset performance and controller interaction still need hardware testing.
