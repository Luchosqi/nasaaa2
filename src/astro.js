// Small astronomy helpers. Low-precision formulas (good to well under a degree),
// enough to put the real Sun, Moon and Milky Way where they belong.
//
// "Celestial frame" used across the app = the frame of the NASA SVS star map as
// three.js maps an equirectangular image:  RA 0h -> +X, RA 6h -> -Z, north pole -> +Y.
import * as THREE from 'three';

const D2R = Math.PI / 180;

export function julian(date) { return date.getTime() / 86400000 + 2440587.5; }

export function raDecToVec(raDeg, decDeg, out = new THREE.Vector3()) {
  const ra = raDeg * D2R, dec = decDeg * D2R;
  return out.set(Math.cos(ra) * Math.cos(dec), Math.sin(dec), -Math.sin(ra) * Math.cos(dec));
}

export function eclToRaDec(lonDeg, latDeg, jd) {
  const n = jd - 2451545.0;
  const eps = (23.439 - 0.0000004 * n) * D2R;
  const l = lonDeg * D2R, b = latDeg * D2R;
  const x = Math.cos(b) * Math.cos(l);
  const y = Math.cos(eps) * Math.cos(b) * Math.sin(l) - Math.sin(eps) * Math.sin(b);
  const z = Math.sin(eps) * Math.cos(b) * Math.sin(l) + Math.cos(eps) * Math.sin(b);
  return { ra: Math.atan2(y, x) / D2R, dec: Math.asin(z) / D2R };
}

/** Geocentric Sun (Astronomical Almanac low-precision). */
export function sunRaDec(date) {
  const jd = julian(date), n = jd - 2451545.0;
  const L = 280.460 + 0.9856474 * n, g = (357.528 + 0.9856003 * n) * D2R;
  const lam = L + 1.915 * Math.sin(g) + 0.020 * Math.sin(2 * g);
  return eclToRaDec(lam, 0, jd);
}

/** Geocentric Moon, simplified (direction to ~1°, distance to ~1%). */
export function moonPos(date) {
  const jd = julian(date), d = jd - 2451545.0;
  const L = 218.316 + 13.176396 * d;
  const M = (134.963 + 13.064993 * d) * D2R;
  const F = (93.272 + 13.229350 * d) * D2R;
  const lon = L + 6.289 * Math.sin(M), lat = 5.128 * Math.sin(F);
  const distKm = 385001 - 20905 * Math.cos(M);
  return { ...eclToRaDec(lon, lat, jd), distKm };
}

/** Direction of the Sun as seen from Mars (Mars mean heliocentric longitude + 180°). */
export function sunFromMarsRaDec(date) {
  const jd = julian(date), d = jd - 2451545.0;
  const L = 355.45 + 0.5240207766 * d;
  return eclToRaDec(L + 180, 0, jd);
}

/** Geocentric direction of Mars (circular-orbit approximation, fine for pointing a camera). */
export function marsRaDec(date) {
  const jd = julian(date), d = jd - 2451545.0;
  const g = (357.528 + 0.9856003 * d) * D2R;
  const sunLon = (280.460 + 0.9856474 * d + 1.915 * Math.sin(g)) * D2R;
  const ex = -Math.cos(sunLon), ey = -Math.sin(sunLon);                // Earth, heliocentric, AU
  const mL = (355.45 + 0.5240207766 * d) * D2R;
  const mx = 1.5237 * Math.cos(mL), my = 1.5237 * Math.sin(mL);       // Mars, heliocentric, AU
  const lon = Math.atan2(my - ey, mx - ex) / D2R;
  return eclToRaDec(lon, 0, jd);
}

/** Greenwich mean sidereal time in degrees (rotates the Earth texture to the real time of day). */
export function gmstDeg(date) {
  const d = julian(date) - 2451545.0;
  return ((280.46061837 + 360.98564736629 * d) % 360 + 360) % 360;
}

/** Local direction from azimuth (0 = north = -Z, 90 = east = +X) and elevation. */
export function azElToVec(azDeg, elDeg, out = new THREE.Vector3()) {
  const az = azDeg * D2R, el = elDeg * D2R;
  return out.set(Math.sin(az) * Math.cos(el), Math.sin(el), -Math.cos(az) * Math.cos(el));
}

/**
 * Rotation that takes celestial-frame vectors into a local scene frame, such that
 * `primaryCel` lands exactly on `primaryLocal` and `secondaryCel` lands as close as possible to `secondaryLocal`.
 */
export function alignFrames(primaryCel, secondaryCel, primaryLocal, secondaryLocal) {
  const basis = (a, b) => {
    const x = a.clone().normalize();
    const z = new THREE.Vector3().crossVectors(x, b).normalize();
    const y = new THREE.Vector3().crossVectors(z, x);
    return new THREE.Matrix4().makeBasis(x, y, z);
  };
  const Mc = basis(primaryCel, secondaryCel), Ml = basis(primaryLocal, secondaryLocal);
  const R = Ml.multiply(Mc.transpose());
  return new THREE.Quaternion().setFromRotationMatrix(R);
}

// Rotation poles of the bodies we stand on (IAU), in RA/Dec degrees.
export const POLES = {
  earth: [0, 90],
  moon: [270.0, 66.54],
  mars: [317.68, 52.89],
};
