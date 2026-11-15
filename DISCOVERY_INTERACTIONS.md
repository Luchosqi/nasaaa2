# Click-to-discover mission stories

Click the equipment after its arrival replay, press **E**, or use **Discover this mission** (which can skip the arrival). Each selection opens a short fact and a six-second illustrative action. Select again or use **Next fact** to cycle stories. **Replay action** repeats the current one; **Close discovery** or Escape closes it. A second Escape returns to orbit.

The UI stays in English to match the existing prototype. Every fact has its own NASA source link. These are illustrations of the equipment's history, not live operations or recorded trajectories. Closing, replaying, or leaving restores the resting pose. The OS reduced-motion preference suppresses the short animations while keeping the facts available. VR has equivalent world-space buttons; physical headset testing is still required.

## Actions and sources

- Opportunity: a short drive and a fact about hematite evidence for **ancient liquid water**; a fading signal for its last contact. [NASA MER science highlights](https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/science-highlights/) is linked from the challenge's [MER mission page](https://science.nasa.gov/mission/mars-exploration-rovers-spirit-and-opportunity/).
- Sojourner: a short drive and its pioneering Mars exploration; final Pathfinder transmission. [NASA Mars Pathfinder](https://science.nasa.gov/mission/mars-pathfinder/), a challenge resource.
- Ingenuity: a short lift, counter-rotating blades, and landing, illustrating its working years. [NASA Ingenuity](https://science.nasa.gov/mission/mars-2020-perseverance/ingenuity-mars-helicopter/), a challenge resource. The second fact recounts 72 flights; the animation is not a recreation of the last flight.
- Apollo 11: communication rings with the first human landing story. [NASA Apollo 11](https://www.nasa.gov/mission/apollo-11/). Its descent stage remains fixed.
- Apollo 15: a short lunar-rover drive with the first rover / Genesis Rock stories. [NASA lunar exploration history](https://science.nasa.gov/solar-system/moon/history-of-lunar-exploration/), already used for this mission. Clicking Falcon also activates this rover story. The LRV was driven by astronauts; the prototype has no astronaut model.
- InSight: seismic rings at SEIS, or fading communication rings. The lander stays fixed. [NASA InSight science](https://science.nasa.gov/mission/insight/science/) and [NASA mission retirement](https://www.nasa.gov/missions/insight/nasa-retires-insight-mars-lander-mission-after-years-of-science/).
- NEAR: communication rings after touchdown and its final contact. [NASA NEAR Shoemaker](https://science.nasa.gov/mission/near-shoemaker/), already used for this mission. No post-landing travel is invented.
- Voyager 1: communication rings with interstellar entry / Pale Blue Dot facts. [NASA Voyager 1](https://science.nasa.gov/mission/voyager/voyager-1/).

All added factual sources are NASA pages. No additional third-party assets or services were added.

## Implementation

`src/discovery-stories.js` contains the text, action type, and source for each mission. `src/discovery.js` owns picking, action playback, desktop/touch controls and VR panels. `src/surface.js` identifies the equipment and optional instrument in each scene. `src/main.js` connects pointer/VR selection and lifecycle cleanup.

The Opportunity GLB is a merged mesh, so this lightweight click action translates the existing model without independently spinning its wheels. Sojourner and the lunar rover have rotating wheels. Ingenuity's named rotor meshes are attached to rotation pivots without editing the source asset. Radio and seismic rings are symbolic visual effects, not actual visible waves.

## Validation (2026-11-14)
JavaScript syntax checks and existing playback checks passed. A local test using real Three.js objects passed for all eight missions: picking, hidden-target exclusion, action playback, repeat/close restoration, completion, navigation cleanup and reduced-motion behavior. Browser checks covered direct Opportunity model selection, NASA source links, next/replay/close controls, keyboard E/Escape, Ingenuity, InSight, Apollo 15 and NEAR, narrow-screen layout, and returning to the landing replay. No new browser console errors were observed. Physical headset testing remains pending.
