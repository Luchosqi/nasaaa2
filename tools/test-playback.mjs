import assert from 'node:assert/strict';
import { createPlayback } from '../src/playback.js';
let frames=[];
const p=createPlayback(40,(t,active)=>{frames.push([t,active]);return active?'history':'resting';});
p.play();p.update(12);p.pause();p.update(7);assert.equal(p.state.time,12);
p.pause();p.update(3);assert.equal(p.state.time,15);
p.finish();assert.equal(p.state.active,false);assert.equal(p.state.caption,'resting');
p.play();assert.equal(p.state.time,0);p.seek(8);assert.equal(p.state.playing,false);assert.equal(p.state.time,8);
p.play();p.update(100);assert.equal(p.state.time,40);assert.equal(p.state.playing,false);assert.equal(p.state.active,false);
p.play();p.seek(NaN);assert.equal(p.state.time,0);p.update(-9);assert.equal(p.state.time,0);
console.log('PASS: pause/resume, replay, seek, skip, end state and invalid timing.');

