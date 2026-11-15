// The space scene: real star sky, Earth (right now), Moon, Mars and the Sun, at true sizes and distances.
// Units are metres. The observer (the player rig) never moves: the universe group moves around it
// ("floating origin"), which keeps precision perfect for VR even 26 billion km from home.
import * as THREE from 'three';
import { raDecToVec, sunRaDec, moonPos, marsRaDec, gmstDeg, POLES } from './astro.js';
import { glowTexture } from './ui.js';

export const R_EARTH = 6.371e6, R_MOON = 1.7374e6, R_MARS = 3.3895e6;
const SUN_SPRITE_DIST = 1e11;

const LOGDEPTH_V = /* glsl */`#include <common>\n#include <logdepthbuf_pars_vertex>\n`;
const LOGDEPTH_F = /* glsl */`#include <common>\n#include <logdepthbuf_pars_fragment>\n`;

export function earthMaterial(tex, sunDir) {
  return new THREE.ShaderMaterial({
    uniforms: {
      uDay: { value: tex.day }, uNight: { value: tex.night }, uClouds: { value: tex.clouds },
      uSun: { value: sunDir }, uCloudShift: { value: 0 },
    },
    vertexShader: LOGDEPTH_V + /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        vUv = uv;
        vN = normalize(mat3(modelMatrix) * normal);
        vec4 w = modelMatrix * vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGDEPTH_F + /* glsl */`
      uniform sampler2D uDay, uNight, uClouds; uniform vec3 uSun; uniform float uCloudShift;
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW), S = normalize(uSun);
        float NdL = dot(N,S);
        vec3 day = texture2D(uDay, vUv).rgb;
        vec3 night = texture2D(uNight, vUv).rgb;
        float cl = texture2D(uClouds, vUv + vec2(uCloudShift,0.0)).r;
        float lit = smoothstep(-0.08, 0.35, NdL);
        float ocean = smoothstep(0.02, 0.08, day.b - max(day.r, day.g));
        vec3 col = day * max(NdL, 0.0) * 1.7;
        // sun glint on the oceans
        vec3 H = normalize(S + V);
        col += vec3(1.0,0.95,0.85) * pow(max(dot(N,H),0.0), 120.0) * ocean * 1.2 * lit * (1.0-cl);
        // city lights on the night side
        col += night * vec3(1.0,0.78,0.45) * 1.6 * (1.0 - smoothstep(-0.25, 0.05, NdL)) * (1.0 - cl);
        // clouds
        vec3 cloudCol = vec3(1.0) * (max(NdL,0.0) * 1.6 + 0.004);
        col = mix(col, cloudCol, cl * 0.95);
        // thin blue limb + warm terminator
        float fr = pow(1.0 - max(dot(N,V),0.0), 3.0);
        col += vec3(0.25,0.5,1.0) * fr * smoothstep(-0.25,0.6,NdL) * 1.4;
        col += vec3(1.0,0.45,0.2) * fr * exp(-pow(NdL*6.0,2.0)) * 0.35;
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}

/** Additive halo around a planet, seen beyond its limb. */
export function atmosphereShell(radius, color, sunDir, strength = 1.0, thickness = 1.03) {
  const mat = new THREE.ShaderMaterial({
    uniforms: { uSun: { value: sunDir }, uColor: { value: new THREE.Color(color) }, uK: { value: strength }, uEdge: { value: Math.sqrt(1 - 1 / (thickness * thickness)) } },
    vertexShader: LOGDEPTH_V + /* glsl */`
      varying vec3 vN; varying vec3 vW;
      void main(){ vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW=w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGDEPTH_F + /* glsl */`
      uniform vec3 uSun, uColor; uniform float uK, uEdge; varying vec3 vN; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        vec3 N = normalize(vN), V = normalize(cameraPosition - vW);
        float rim = clamp(-dot(N,V), 0.0, 1.0);       // back faces: 1 at the centre, 0 at the outer edge
        float a = pow(clamp(rim / uEdge, 0.0, 1.0), 2.5);          // brightest at the planet's limb
        float lit = smoothstep(-0.35, 0.4, dot(N, normalize(uSun)));
        gl_FragColor = vec4(uColor * a * lit * uK, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
    side: THREE.BackSide, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
  });
  return new THREE.Mesh(new THREE.SphereGeometry(radius * thickness, 96, 48), mat);
}

export function createSpace({ tex, starTex, now = new Date() }) {
  const scene = new THREE.Scene();
  scene.background = starTex;
  scene.backgroundIntensity = 0.8;

  const universe = new THREE.Group();                // celestial frame, Earth at its origin
  scene.add(universe);

  // Sun: real direction for today. Light travels in the universe frame.
  const sunCel = raDecToVec(sunRaDec(now).ra, sunRaDec(now).dec);
  const sunLight = new THREE.DirectionalLight(0xfff4e8, 3.2);
  sunLight.position.copy(sunCel).multiplyScalar(1e3);
  universe.add(sunLight, sunLight.target);
  scene.add(new THREE.AmbientLight(0x334466, 0.07));
  const sunWorld = new THREE.Vector3();               // updated per frame (world-space sun direction)

  // Earth
  const earth = new THREE.Mesh(new THREE.SphereGeometry(R_EARTH, 192, 96), earthMaterial(tex, sunWorld));
  earth.rotation.y = gmstDeg(now) * Math.PI / 180;    // real time of day
  universe.add(earth);
  const earthAtmo = atmosphereShell(R_EARTH, 0x4d8dff, sunWorld, 1.4, 1.035);
  universe.add(earthAtmo);

  // Moon (real direction & distance today), tidally locked: near side faces Earth.
  const mp = moonPos(now);
  const moonDir = raDecToVec(mp.ra, mp.dec);
  const moon = new THREE.Mesh(
    new THREE.SphereGeometry(R_MOON, 160, 80),
    new THREE.MeshStandardMaterial({ map: tex.moon, normalMap: tex.moonNormal, normalScale: new THREE.Vector2(1, 1), roughness: 1, metalness: 0 })
  );
  moon.position.copy(moonDir).multiplyScalar(mp.distKm * 1000);
  // texture centre (lon 0) is +X in local space: point it at Earth
  moon.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), moonDir.clone().negate());
  universe.add(moon);

  // Mars (real direction today, placed at the average distance used in the story)
  const md = marsRaDec(now);
  const marsDir = raDecToVec(md.ra, md.dec);
  const mars = new THREE.Mesh(
    new THREE.SphereGeometry(R_MARS, 160, 80),
    new THREE.MeshStandardMaterial({ map: tex.mars, roughness: 1, metalness: 0 })
  );
  mars.position.copy(marsDir).multiplyScalar(225e9);
  const marsPole = raDecToVec(...POLES.mars);
  mars.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), marsPole);
  universe.add(mars);
  const marsAtmo = atmosphereShell(R_MARS, 0xd89a6a, sunWorld, 0.55, 1.02);
  marsAtmo.position.copy(mars.position);
  universe.add(marsAtmo);

  // Sun sprite: kept at a fixed distance from the observer so it is always "at infinity".
  const sunCore = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,255,255,1)'], [0.18, 'rgba(255,252,240,1)'], [0.28, 'rgba(255,230,190,0.35)'], [1, 'rgba(255,180,120,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  const sunHalo = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,250,240,0.7)'], [0.06, 'rgba(255,244,228,0.3)'], [0.25, 'rgba(255,230,205,0.06)'], [1, 'rgba(255,220,190,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  sunCore.renderOrder = sunHalo.renderOrder = -1;
  scene.add(sunCore, sunHalo);

  // The Sun as a real sphere (only noticeable when you travel close to it)
  const AU = 1.496e11, R_SUN = 6.957e8;
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(R_SUN, 96, 48), new THREE.ShaderMaterial({
    uniforms: { uTex: { value: tex.sun }, uT: { value: 0 } },
    vertexShader: LOGDEPTH_V + /* glsl */`
      varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){ vUv = uv; vN = normalize(mat3(modelMatrix)*normal); vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz;
        gl_Position = projectionMatrix*viewMatrix*w;
        #include <logdepthbuf_vertex>
      }`,
    fragmentShader: LOGDEPTH_F + /* glsl */`
      uniform sampler2D uTex; uniform float uT; varying vec2 vUv; varying vec3 vN; varying vec3 vW;
      void main(){
        #include <logdepthbuf_fragment>
        float mu = max(dot(normalize(vN), normalize(cameraPosition - vW)), 0.0);
        vec3 a = texture2D(uTex, vUv + vec2(uT * 0.0004, 0.0)).rgb;
        vec3 b = texture2D(uTex, vUv * 1.7 - vec2(uT * 0.0007, uT * 0.0002)).rgb;
        vec3 col = (a * 0.7 + b * 0.5) * vec3(1.5, 1.3, 1.0) * (0.35 + 0.65 * pow(mu, 0.45));   // limb darkening
        gl_FragColor = vec4(col * 7.0, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  }));
  sunMesh.position.copy(sunCel).multiplyScalar(AU);
  universe.add(sunMesh);
  const corona = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(255,240,215,0.9)'], [0.14, 'rgba(255,220,170,0.55)'], [0.3, 'rgba(255,190,130,0.12)'], [1, 'rgba(255,160,100,0)']]),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  corona.scale.setScalar(R_SUN * 7); sunMesh.add(corona);

  // Pale Blue Dot marker (only used far from home)
  const paleDot = new THREE.Sprite(new THREE.SpriteMaterial({
    map: glowTexture([[0, 'rgba(170,210,255,1)'], [0.3, 'rgba(120,170,255,0.5)'], [1, 'rgba(80,140,255,0)']], 64),
    blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false,
  }));
  paleDot.visible = false; scene.add(paleDot);

  // Speed dust: faint particles flowing past during the cruise (gives a sense of motion, kept subtle for VR comfort)
  const N = 700, dustBox = 60;
  const dPos = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) { dPos[i * 3] = (Math.random() - .5) * dustBox; dPos[i * 3 + 1] = (Math.random() - .5) * dustBox; dPos[i * 3 + 2] = (Math.random() - .5) * dustBox; }
  const dustGeo = new THREE.BufferGeometry(); dustGeo.setAttribute('position', new THREE.BufferAttribute(dPos, 3));
  const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
    size: 0.035, color: 0xaabbee, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending,
    map: glowTexture([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 32),
  }));
  dust.frustumCulled = false;
  scene.add(dust);

  // ----- observer state (double precision, celestial frame, metres from Earth's centre)
  const obs = new THREE.Vector3(0, 0, 3e7);
  const tmp = new THREE.Vector3(), tmpQ = new THREE.Quaternion();

  const api = {
    scene, universe, earth, moon, mars, sunCel, moonDir, marsDir, obs, sunWorld,
    dust, dustSpeed: 0, dustOpacity: 0, paleDot,
    bodies: { moon, mars }, sunMesh, AU, R_SUN,
    /** set the clock: the Sun's direction and Earth's rotation follow (used for each launch date) */
    setDate(date) {
      const sr = sunRaDec(date);
      raDecToVec(sr.ra, sr.dec, sunCel);
      sunLight.position.copy(sunCel).multiplyScalar(1e3);
      sunMesh.position.copy(sunCel).multiplyScalar(AU);
      earth.rotation.y = gmstDeg(date) * Math.PI / 180;
      api.date = date;
    },
    setFrame(q) { universe.quaternion.copy(q); scene.backgroundRotation.setFromQuaternion(q); },
    /** world-space position of a celestial-frame point */
    toWorld(p, out = new THREE.Vector3()) { return out.copy(p).sub(obs).applyQuaternion(universe.quaternion); },
    update(dt, t) {
      universe.position.copy(obs).negate().applyQuaternion(universe.quaternion);
      sunWorld.copy(sunCel).applyQuaternion(universe.quaternion).normalize();
      earth.material.uniforms.uCloudShift.value = t * 0.0000015;
      sunMesh.material.uniforms.uT.value = t;
      // the halo is meant to be seen from outside; from inside the upper atmosphere the sky is nearly black
      const alt = obs.length() - R_EARTH;
      earthAtmo.material.uniforms.uK.value = 1.4 * Math.min(1, Math.max(0.03, (alt - 150e3) / 400e3));

      // Sun: real angular size (0.53° at 1 AU), shrinking with distance, never smaller than a bright star.
      // Its direction is taken from where we actually are (it matters on the way to Voyager).
      tmp.copy(sunCel).multiplyScalar(1.496e11).sub(obs);
      const distAU = Math.max(1, tmp.length() / 1.496e11);
      tmp.normalize().applyQuaternion(universe.quaternion);
      sunCore.position.copy(tmp).multiplyScalar(SUN_SPRITE_DIST);
      sunHalo.position.copy(sunCore.position);
      const ang = Math.max(0.0094 / distAU, 0.0016);
      sunCore.scale.setScalar(SUN_SPRITE_DIST * ang * 3.2);
      sunHalo.scale.setScalar(SUN_SPRITE_DIST * Math.max(0.35 / distAU, 0.012));
      sunHalo.material.opacity = Math.min(1, 0.25 + 0.75 / distAU);

      // things beyond the far plane: hide
      const dE = obs.length();
      earth.visible = earthAtmo.visible = dE < 5e11;
      tmp.copy(mars.position).sub(obs);
      mars.visible = marsAtmo.visible = tmp.length() < 5e11;

      // dust
      const p = dust.geometry.attributes.position;
      const sp = api.dustSpeed * dt;
      for (let i = 0; i < N; i++) {
        let z = p.array[i * 3 + 2] + sp;
        if (z > dustBox / 2) { z -= dustBox; p.array[i * 3] = (Math.random() - .5) * dustBox; p.array[i * 3 + 1] = (Math.random() - .5) * dustBox; }
        p.array[i * 3 + 2] = z;
      }
      p.needsUpdate = true;
      dust.material.opacity += (api.dustOpacity - dust.material.opacity) * Math.min(1, dt * 2);
      dust.visible = dust.material.opacity > 0.01;
    },
  };
  return api;
}
