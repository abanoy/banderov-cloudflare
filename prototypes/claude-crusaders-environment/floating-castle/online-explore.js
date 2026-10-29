import { CrusadersClient } from './online-client.js';
import { sceneHash } from './online-scene.js';
import { roomOccupancyLabel } from './online-protocol.js';

// Opt-in exploration preview. No game simulation, collision, combat or saves are changed.
export function startExploreLink({ T, scene, actor, sample, invalidate, backend }) {
  const panel = document.createElement('details');
  panel.id = 'online-explore';
  panel.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:80;background:#172b39;color:#fff;padding:10px;border:1px solid #a6fff0;border-radius:6px;width:260px;max-width:calc(100vw - 44px);font:14px sans-serif';
  panel.open = true;
  const add = (tag, text, parent = panel) => {
    const node = document.createElement(tag);
    if (text) node.textContent = text;
    parent.append(node);
    return node;
  };
  add('summary', 'Online explore · preview');
  add('p', 'Two explorers only. Battles and castle edits stay local.');
  const status = add('p', 'Not connected'); status.setAttribute('role','status');
  const peerInfo = add('p');
  const occupancyInfo = add('p','Human players are counted separately from bots.');
  const labelName = add('label','Name '), name = add('input','',labelName);
  name.maxLength = 24; name.value = 'Explorer'; name.style.width = '150px';
  const publicLabel = add('label',' Public room '), publicRoom = add('input','',publicLabel); publicRoom.type = 'checkbox';
  const botLabel = add('label',' Play with bots '), playWithBots = add('input','',botLabel); playWithBots.type = 'checkbox';playWithBots.checked = true;
  add('p','Fill empty battle places with bots. Online battles are not active in this exploration preview.');
  const controls = add('div');
  const create = add('button','Create room',controls), leave = add('button','Leave',controls);
  const joinLabel = add('label','Room code '), code = add('input','',joinLabel); code.maxLength = 12; code.style.width = '110px';
  const join = add('button','Join room'), list = add('button','Find rooms');
  const rooms = add('div');
  panel.addEventListener('keydown', event => event.stopPropagation());
  panel.addEventListener('pointerdown', event => event.stopPropagation());
  panel.addEventListener('wheel', event => event.stopPropagation());
  const peer = new T.Sprite(actor.material.clone()); peer.center.copy(actor.center); peer.scale.copy(actor.scale);
  peer.visible = false;
  let target = null, receivedAt = 0, lastFrame = performance.now(), active = false, destroyed = false, frame;
  const state = connected => { create.disabled = join.disabled = publicRoom.disabled = name.disabled = code.disabled = connected; leave.disabled = !connected; playWithBots.disabled = connected; };
  state(false);
  const client = new CrusadersClient({ base: backend, sceneHash, onEvent(event) {
    if (event.type === 'room') { code.value = event.room; status.textContent = 'Room ' + event.room + ' · connecting'; }
    if (event.type === 'ready') { active = true; state(true);playWithBots.disabled = event.role !== 'host'; status.textContent = 'Room ' + code.value + ' · connected · waiting for explorer'; }
    if (event.type === 'room-state') { playWithBots.checked = event.occupancy.playWithBots;occupancyInfo.textContent = roomOccupancyLabel(event.occupancy); }
    if (event.type === 'presence') {
      target = event; receivedAt = performance.now();
      if (!peer.visible || peer.position.distanceToSquared(new T.Vector3(event.x,event.y,event.z)) > 400) peer.position.set(event.x,event.y,event.z);
      peer.visible = true; status.textContent = 'Room ' + code.value + ' · other explorer connected' + (event.paused ? ' (paused)' : '');
      peerInfo.textContent = 'Other explorer · ' + (event.flight ? 'in flight' : 'on foot') + ' · ' + Math.round(event.y) + ' m';
      invalidate();
    }
    if (event.type === 'closed') { active = false; target = null; peer.visible = false; peerInfo.textContent = ''; occupancyInfo.textContent = 'Not in a room';rooms.replaceChildren();state(false); status.textContent = event.reason; invalidate(); }
  } });
  // Added once the client accepted the backend (an invalid one throws above and leaves nothing behind). The panel is shown
  // only where it can be used (Explore the Aerie): hidden over the title, setup, battles and the workshop.
  scene.add(peer); document.body.append(panel); panel.hidden = !sample();
  function connect(options) {
    if(client.socket) { status.textContent = 'Leave the current room before joining another.';return; }
    if (!sample()) { status.textContent = 'Choose Explore the Aerie first. Leave battle or workshop before connecting.'; return; }
    try { client.connect({ name: name.value, ...options }); state(true); status.textContent = 'Connecting…'; }
    catch (error) { state(false); status.textContent = error.message; }
  }
  create.onclick = () => connect({ publicRoom: publicRoom.checked,playWithBots:playWithBots.checked });
  playWithBots.onchange = () => { if(active && !client.setPlayWithBots(playWithBots.checked))status.textContent = 'Only the room creator can change bot settings.'; };
  join.onclick = () => connect({ code: code.value.trim().toUpperCase() });
  leave.onclick = () => client.leave();
  list.onclick = async () => {
    list.disabled = true;
    try {
      const entries = await client.rooms(); rooms.replaceChildren();
      if (!entries.length) rooms.textContent = 'No public rooms waiting.';
      for (const room of entries) {
        if (typeof room.code !== 'string' || !/^[A-Z0-9]{3,12}$/.test(room.code)) continue;
        const button = add('button',String(room.name || 'Explorer') + ' · ' + room.code+' · '+roomOccupancyLabel(room.occupancy),rooms);
        button.onclick = () => { code.value = room.code; connect({ code: room.code }); };
      }
    } catch (error) { status.textContent = error.message; }
    finally { list.disabled = false; }
  };
  const timer = setInterval(() => {
    const pose = sample();
    if (panel.hidden !== !pose) panel.hidden = !pose;
    if (!active) return;
    if (!pose) { client.leave('Exploration room closed before battle, workshop or title'); return; }
    client.presence(pose);
    if (peer.visible && performance.now() - receivedAt > 1000) { peer.visible = false; status.textContent = 'Waiting for the other explorer’s connection'; invalidate(); }
  }, 110); // Below the server's 10/s presence cap, including timer jitter.
  function render(now) {
    if (destroyed) return;
    const dt = Math.min(.1,(now-lastFrame)/1000); lastFrame = now;
    if (target && peer.visible) {
      peer.position.lerp(new T.Vector3(target.x,target.y+(target.flight?.7:0),target.z),1-Math.exp(-dt*16));
      peer.material.map = actor.userData.maps[0];
      invalidate();
    }
    frame = requestAnimationFrame(render);
  }
  frame = requestAnimationFrame(render);
  const close = () => client.leave('Page closed');
  addEventListener('pagehide',close);
  return { client, dispose() {
    destroyed = true; clearInterval(timer); cancelAnimationFrame(frame); removeEventListener('pagehide',close);
    client.leave(); scene.remove(peer); peer.material.dispose(); panel.remove();
  } };
}
