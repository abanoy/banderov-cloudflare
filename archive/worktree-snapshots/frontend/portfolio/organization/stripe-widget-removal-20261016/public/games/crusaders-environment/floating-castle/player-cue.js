import * as T from '../vendor/three.module.js';
// Reuse only the owner's sprite alpha. This local-player cue is never added
// to collision/aim surfaces and never reveals opponents through castle walls.
export function createPlayerCue(scene,actor,camera){
 const material=new T.SpriteMaterial({map:actor.material.map,color:0x9cfff0,alphaTest:.35,transparent:true,opacity:.55,depthTest:false,depthWrite:false,fog:false});
 material.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('vec4 diffuseColor = vec4( diffuse, opacity );','vec4 diffuseColor = vec4( diffuse, 1. );').replace('#include <alphatest_fragment>','#include <alphatest_fragment>\ndiffuseColor.a *= opacity;').replace('gl_FragColor = vec4( outgoingLight, diffuseColor.a );','gl_FragColor = vec4( diffuse, diffuseColor.a );');};
 material.customProgramCacheKey=()=> 'local-player-alpha-cue-v3';
 const cue=new T.Sprite(material);cue.name='Local player through-wall cue';cue.center.set(.5,.5);cue.renderOrder=25;cue.visible=false;scene.add(cue);
 const point=new T.Vector3(),cameraUp=new T.Vector3();
 function center(out){return out.copy(actor.position).addScaledVector(cameraUp.setFromMatrixColumn(camera.matrixWorld,1),actor.scale.y*(.5-actor.center.y));}
 function update({occluded=false,enabled=true,time=0,viewportHeight=720}={}){
  center(point);const inView=point.project(camera);
  cue.visible=enabled&&occluded&&actor.visible&&inView.z>=-1&&inView.z<=1&&Math.abs(inView.x)<1&&Math.abs(inView.y)<1;
  if(!cue.visible)return;
  center(cue.position);
  const height=Math.max(actor.scale.y,(camera.top-camera.bottom)/camera.zoom*24/Math.max(1,viewportHeight));
  cue.scale.set(height*actor.scale.x/actor.scale.y,height,1);material.map=actor.material.map;material.opacity=.5+Math.sin(time*3)*.08;
 }
 return {update,center,dispose(){scene.remove(cue);material.dispose();},sprite:cue};
}
