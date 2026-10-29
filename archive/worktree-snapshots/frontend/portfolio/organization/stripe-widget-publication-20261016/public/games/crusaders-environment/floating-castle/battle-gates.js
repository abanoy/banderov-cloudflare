import * as T from '../vendor/three.module.js';
export function createBattleGates({world,actors,getCombat,onMessage=()=>{}}){
 const items=[],point=new T.Vector3();
 function pose(g){const f=Math.max(.001,1-g.progress);g.leaf.visible=g.hp>0&&g.progress<.999;g.leaf.scale.y=6.1*f;g.leaf.position.y=3.05+3.05*g.progress;g.leaf.updateWorldMatrix(true,false);g.leaf.userData.gateHp=g.hp;g.leaf.userData.gateOpen=g.progress>=.999;}
 function sync(){items.length=0;for(const castle of world.castles)castle.traverse(leaf=>{if(!leaf.userData.gateLeaf)return;for(let p=leaf.parent;p;p=p.parent)if(!p.visible)return;items.push({id:leaf.userData.gateId,team:leaf.userData.gateTeam,leaf,hp:2000,maxHp:2000,open:true,progress:1,manual:false,lastFriendly:0});});for(const g of items)pose(g);}
 function begin(){for(const g of items){g.hp=2000;g.open=false;g.progress=0;g.manual=false;g.lastFriendly=-Infinity;pose(g);}}
 function nearest(actor){let result=null,distance=14;for(const g of items)if(g.team===actor.team&&g.hp>0){g.leaf.getWorldPosition(point);const d=Math.hypot(point.x-actor.state.x,point.y-actor.state.y-3,point.z-actor.state.z);if(d<distance){result=g;distance=d;}}return result;}
 function toggle(actor=actors[0]){const g=nearest(actor);if(!g||!actor.alive)return false;g.open=!g.open;g.manual=true;onMessage((g.open?'Opening':'Closing')+' friendly gate · '+Math.ceil(g.hp)+'/2000 HP');return true;}
 function step(dt){const combat=getCombat();if(!combat)return;const time=combat.state.time;
  for(const g of items){g.leaf.getWorldPosition(point);if(!g.manual&&g.hp>0){const friendly=actors.some(a=>a.alive&&a.team===g.team&&Math.abs(a.state.y-point.y+3)<5&&Math.hypot(a.state.x-point.x,a.state.z-point.z)<11);if(friendly)g.lastFriendly=time;g.open=friendly||time-g.lastFriendly<2;}
   const target=g.open||g.hp<=0?1:0;g.progress+=Math.sign(target-g.progress)*Math.min(Math.abs(target-g.progress),dt*1.8);pose(g);
   if(g.hp<=0||g.progress>.75||combat.state.shields[g.team]>0)continue;
   for(const a of actors)if(!a.human&&a.alive&&a.team!==g.team&&!a.mount&&Math.abs(a.state.y-point.y+3)<7&&Math.hypot(a.state.x-point.x,a.state.z-point.z)<26){const hit=combat.collision.firstHit({x:a.state.x,y:a.state.y+1.05,z:a.state.z},point);if(hit?.object.userData.gateId!==g.id||a.weapon===5)continue;a.reason='Breaching a closed enemy gate';if(a.weapon===3)a.charge=Math.min(1.15,(a.charge||0)+dt);combat.fire(a,{x:point.x,y:point.y,z:point.z});}
  }
 }
 function status(actor=actors[0]){const g=nearest(actor);return g?'B · '+(g.open?'Close':'Open')+' gate · '+Math.ceil(g.hp)+'/2000 HP':'B · Nearby friendly gate';}
 sync();return {items,sync,begin,step,toggle,status,nearest,clear(){for(const g of items){g.open=true;g.progress=1;pose(g);}},snapshot:()=>items.map(g=>({id:g.id,team:g.team,hp:g.hp,open:g.open,progress:g.progress}))};
}
