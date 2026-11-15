import * as THREE from 'three';
import { createPlayback } from './playback.js';

// Compressed, educational reconstructions, not mission telemetry.
export function createExtraMotion(m, out, models) {
  const group = new THREE.Group(); group.position.set(0,out.heightAt(0,-9),-9); out.scene.add(group);
  const original = m.id === 'near' ? models.near : models.insight;
  const obj = original.clone(true), box = new THREE.Box3().setFromObject(obj), dim=box.getSize(new THREE.Vector3());
  obj.scale.multiplyScalar((m.id==='near'?2.8:5.8)/Math.max(dim.x,dim.y,dim.z));
  const bounds=new THREE.Box3().setFromObject(obj),center=bounds.getCenter(new THREE.Vector3()); obj.position.sub(new THREE.Vector3(center.x,bounds.min.y,center.z)); group.add(obj);
  const finalY=0, duration=m.id==='near'?24:32;
  const flame=new THREE.Mesh(new THREE.ConeGeometry(.22,1.8,12,1,true),new THREE.MeshBasicMaterial({color:0xffaa55,transparent:true,opacity:.65,side:THREE.DoubleSide,depthWrite:false})); flame.position.y=-.9; group.add(flame);
  const parachute=new THREE.Group(); group.add(parachute);
  const canopy=new THREE.Mesh(new THREE.SphereGeometry(2,24,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xe8ddd0,side:THREE.DoubleSide})); canopy.position.y=5; parachute.add(canopy);
  const lines=[];for(let i=0;i<8;i++){let a=i*Math.PI/4;const geo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,1,0),new THREE.Vector3(Math.cos(a)*2,5,Math.sin(a)*2)]);lines.push(new THREE.Line(geo,new THREE.LineBasicMaterial({color:0xffffff})));}parachute.add(...lines);
  const seis=new THREE.Mesh(new THREE.SphereGeometry(.35,20,12,0,Math.PI*2,0,Math.PI/2),new THREE.MeshStandardMaterial({color:0xd4d0c8,roughness:.85}));seis.position.set(3,0,1);group.add(seis);
  let motion=createPlayback(duration,(t,active)=>{
    group.visible=active;out.artifacts.forEach(o=>o.visible=!active);out.labels.forEach(o=>o.visible=!active);
    if(!active)return 'FINAL RESTING SITE · Explore the equipment left behind.';
    const q=Math.max(0,Math.min(1,t/14)); const ease=q*q*(3-2*q);
    obj.parent.position.y=out.heightAt(0,-9)+finalY+(1-ease)*10;
    obj.parent.position.z=-9-(1-ease)*10;
    flame.visible=t<14;parachute.visible=m.id==='insight'&&t<7;seis.visible=m.id==='insight'&&t>=22;seis.scale.setScalar(Math.min(1,Math.max(.01,(t-22)/3)));
    if(m.id==='near')return t<14?'FEB 12, 2001 · NEAR uses controlled burns to descend toward asteroid Eros. Trajectory and terrain are illustrative.':'TOUCHDOWN · NEAR survives and sends back measurements for about two weeks.';
    if(t<7)return 'NOV 26, 2018 · A parachute slows InSight in the Martian atmosphere. Earlier entry is omitted.';
    if(t<14)return 'FINAL DESCENT · Braking rockets lower the stationary lander to Elysium Planitia.';
    if(t<22)return 'TOUCHDOWN · InSight later opens its solar panels. The model shows the deployed configuration throughout.';
    return 'TIME JUMP · SEIS appears to represent its later deployment by the robotic arm; the arm is not animated.';
  });
  motion.finish();out.updaters.push(dt=>motion.update(dt));
  motion.dispose=()=>{parachute.traverse(o=>{o.geometry?.dispose();o.material?.dispose();});flame.geometry.dispose();flame.material.dispose();seis.geometry.dispose();seis.material.dispose();group.removeFromParent();};
  return motion;
}
