import { PREFIX, CRUSADERS, sceneHashValid, validatePresence, validRoomOccupancy } from './online-protocol.js';

export class CrusadersClient {
  constructor({ base, sceneHash, onEvent = () => {}, WebSocketImpl = globalThis.WebSocket, fetchImpl = globalThis.fetch?.bind(globalThis) }) {
    const url = new URL(base);
    const local = ['127.0.0.1','localhost','[::1]'].includes(url.hostname);
    if (url.username || url.password || url.pathname !== '/' || url.search || url.hash ||
        !(url.protocol === 'https:' || local && url.protocol === 'http:') || !sceneHashValid(sceneHash)) {
      throw new Error('Invalid server or scene version');
    }
    this.base = url.origin;
    this.sceneHash = sceneHash;
    this.emit = onEvent;
    this.WebSocket = WebSocketImpl;
    this.fetch = fetchImpl;
    this.generation = 0;
  }
  async rooms() {
    let response;
    try { response = await this.fetch(this.base + PREFIX + '/rooms', { credentials: 'omit' }); }
    catch { throw new Error('Server not reachable (' + this.base + '). Start the local preview server first.'); }
    if (!response.ok) throw new Error('Server connection is not available (' + response.status + ')');
    const data = await response.json();
    if (!Array.isArray(data.rooms) || data.rooms.length > 300) throw new Error('Invalid room list');
    return data.rooms;
  }
  connect({ name = 'Explorer', code, publicRoom = false, playWithBots = true } = {}) {
    if (this.socket) throw new Error('Leave the current room first');
    if (typeof playWithBots !== 'boolean') throw new Error('Choose whether to play with bots');
    if (code !== undefined && !/^[A-Z0-9]{3,12}$/.test(code)) throw new Error('Enter a room code (3–12 letters or numbers)');
    const url = new URL(this.base + PREFIX + '/ws');
    url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
    url.searchParams.set('scene', this.sceneHash);
    url.searchParams.set('name', String(name).slice(0,24));
    if (code !== undefined) url.searchParams.set('join', code);
    else { url.searchParams.set('create','1'); url.searchParams.set('public', publicRoom ? '1' : '0'); url.searchParams.set('bots',playWithBots?'1':'0'); }
    const socket = new this.WebSocket(url.toString());
    const generation = ++this.generation;
    this.socket = socket;
    this.epoch = null;
    this.seq = 0;
    this.peerSequence = 0;
    const finish = reason => {
      if (generation !== this.generation) return;
      this.generation++;
      clearTimeout(this.handshake);
      this.socket = null;
      this.epoch = null;
      this.emit({ type: 'closed', reason });
    };
    this.handshake = setTimeout(() => { finish('Connection timed out'); socket.close(); }, 8000);
    socket.onmessage = event => {
      if (generation !== this.generation) return;
      let message;
      try {
        if (typeof event.data !== 'string' || event.data.length > 2048) throw new Error();
        message = JSON.parse(event.data);
      } catch { finish('Invalid server message'); socket.close(); return; }
      if (message.t === 'created' || message.t === 'joined') {
        this.emit({ type: 'room', room: message.room, role: message.role });
        socket.send(JSON.stringify({ t: 'm', d: { type: 'hello', v: 1, sceneHash: this.sceneHash } }));
      } else if (message.t === 'm' && message.from === 'server') {
        const data = message.d;
        if (data?.type === 'ready' && data.v === 1 && data.sceneHash === this.sceneHash &&
            typeof data.epoch === 'string' && data.epoch.length <= 128 && ['host','guest'].includes(data.role)) {
          if (this.epoch) return; // Do not reset sequence state on a repeated hello response.
          clearTimeout(this.handshake);
          this.epoch = data.epoch;
          this.role = data.role;
          this.emit(data);
        } else if (data?.type === 'room-state' && data.v === 1 && data.epoch === this.epoch && validRoomOccupancy(data.occupancy)) {
          this.emit(data);
        } else if (data?.type === 'presence' && data.epoch === this.epoch &&
                   ['host','guest'].includes(data.role) && data.role !== this.role) {
          const { role, serverMs, ...pose } = data;
          const clean = validatePresence(pose, this.epoch, this.peerSequence);
          if (!clean || !Number.isFinite(serverMs)) return;
          this.peerSequence = pose.seq;
          this.emit({ ...clean, role, serverMs });
        } else if (data?.type === 'ack' && data.epoch === this.epoch && Number.isSafeInteger(data.seq) && data.seq <= this.seq) {
          this.emit(data);
        }
      } else if (['closed','peer-left','error'].includes(message.t)) {
        finish(message.reason || 'Other explorer left');
        socket.close();
      }
    };
    socket.onclose = event => finish(event.reason || 'Connection closed (' + event.code + ')');
    socket.onerror = () => { finish('Could not connect to the server'); socket.close(); };
  }
  presence(pose) {
    if (!this.socket || !this.epoch || this.socket.readyState !== 1 || this.socket.bufferedAmount > 4096) return false;
    const data = { type: 'presence', v: 1, epoch: this.epoch, seq: this.seq + 1, ...pose };
    if (!validatePresence(data, this.epoch, this.seq)) return false;
    this.socket.send(JSON.stringify({ t: 'm', d: data }));
    this.seq = data.seq;
    return true;
  }
  setPlayWithBots(value) {
    if (typeof value !== 'boolean' || !this.epoch || this.role !== 'host' || this.socket?.readyState !== 1) return false;
    this.socket.send(JSON.stringify({t:'m',d:{type:'settings',v:1,epoch:this.epoch,playWithBots:value}}));
    return true;
  }
  leave(reason = 'Left the room') {
    const socket = this.socket;
    this.generation++;
    clearTimeout(this.handshake);
    this.socket = null;
    this.epoch = null;
    if (socket) {
      if (socket.readyState === 1) socket.send(JSON.stringify({ t: 'leave' }));
      socket.close();
    }
    this.emit({ type: 'closed', reason });
  }
}

export const game = CRUSADERS;
