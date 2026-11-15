// Phones and tablets (not standalone headsets): lighter textures and offline downloads.
const UA = typeof navigator === 'undefined' ? '' : navigator.userAgent;
export const handheld = (/Android|iPhone|iPad|Mobile/i.test(UA) || (/Macintosh/.test(UA) && navigator.maxTouchPoints > 1)) && !/OculusBrowser|Quest|Pico/i.test(UA);
