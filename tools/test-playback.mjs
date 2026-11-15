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

// step mode: starts held, plays one stage, holds when the caption changes
const s=createPlayback(30,(t,active)=>!active?'rest':t<10?'A':t<20?'B':'C');
s.setStep(true);s.play();assert.equal(s.state.playing,false);assert.equal(s.state.caption,'A');
s.pause();for(let i=0;i<40;i++)s.update(0.5);assert.equal(s.state.caption,'B');assert.equal(s.state.playing,false);assert.ok(s.state.time>=10&&s.state.time<10.6);
s.pause();for(let i=0;i<40;i++)s.update(0.5);assert.equal(s.state.caption,'C');assert.equal(s.state.playing,false);
s.pause();for(let i=0;i<40;i++)s.update(0.5);assert.equal(s.state.active,false);assert.equal(s.state.caption,'rest');
s.setStep(false);s.play();assert.equal(s.state.playing,true);s.update(15);assert.equal(s.state.playing,true);
console.log('PASS: pause/resume, replay, seek, skip, end state, invalid timing and step mode.');
