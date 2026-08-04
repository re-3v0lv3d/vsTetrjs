import Peer, { type DataConnection } from 'peerjs';
import { decode, generateRoomCode, roomPeerId, type NetMessage } from './protocol';

export type RoomRole = 'host' | 'guest';

export interface RoomCallbacks {
  onStatus: (text: string) => void;
  onConnected: (role: RoomRole, code: string) => void;
  onMessage: (msg: NetMessage) => void;
  onDisconnected: () => void;
  onError: (err: string) => void;
}

function createPeer(id?: string): Peer {
  const host = import.meta.env.VITE_PEER_HOST;
  if (!host) {
    return id ? new Peer(id) : new Peer();
  }
  const options = {
    host,
    port: Number(import.meta.env.VITE_PEER_PORT ?? 443),
    path: import.meta.env.VITE_PEER_PATH ?? '/',
    secure: import.meta.env.VITE_PEER_SECURE !== 'false',
    key: import.meta.env.VITE_PEER_KEY ?? 'peerjs',
    debug: 1 as const,
  };
  return id ? new Peer(id, options) : new Peer(options);
}

export class PeerRoom {
  private peer: Peer | null = null;
  private conn: DataConnection | null = null;
  role: RoomRole | null = null;
  code: string | null = null;
  private cbs: RoomCallbacks;

  constructor(cbs: RoomCallbacks) {
    this.cbs = cbs;
  }

  async host(): Promise<string> {
    await this.destroy();
    const code = generateRoomCode();
    const id = roomPeerId(code);
    this.role = 'host';
    this.code = code;
    this.cbs.onStatus('Creando sala…');

    const peer = createPeer(id);
    this.peer = peer;

    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('Timeout creando sala')), 12000);
      peer.on('open', () => {
        clearTimeout(t);
        resolve();
      });
      peer.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    this.cbs.onStatus(`Sala ${code} — esperando rival…`);
    peer.on('connection', (conn) => {
      if (this.conn?.open) {
        conn.close();
        return;
      }
      this.wire(conn);
    });

    return code;
  }

  async join(code: string): Promise<void> {
    await this.destroy();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 4) throw new Error('Código inválido');
    this.role = 'guest';
    this.code = clean;
    this.cbs.onStatus('Conectando…');

    const peer = createPeer();
    this.peer = peer;

    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('Timeout PeerJS')), 12000);
      peer.on('open', () => {
        clearTimeout(t);
        resolve();
      });
      peer.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    const conn = peer.connect(roomPeerId(clean), { reliable: true });
    await new Promise<void>((resolve, reject) => {
      const t = window.setTimeout(() => reject(new Error('No se encontró la sala')), 15000);
      conn.on('open', () => {
        clearTimeout(t);
        resolve();
      });
      conn.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
      peer.on('error', (err) => {
        clearTimeout(t);
        reject(err);
      });
    });

    this.wire(conn);
  }

  private wire(conn: DataConnection): void {
    this.conn = conn;
    conn.on('data', (data) => {
      if (typeof data === 'object' && data && 't' in (data as object)) {
        this.cbs.onMessage(data as NetMessage);
        return;
      }
      const raw = typeof data === 'string' ? data : JSON.stringify(data);
      const msg = decode(raw);
      if (msg) this.cbs.onMessage(msg);
    });
    conn.on('close', () => {
      this.cbs.onDisconnected();
    });
    conn.on('error', (err) => {
      this.cbs.onError(String(err));
    });
    if (this.role && this.code) {
      this.cbs.onConnected(this.role, this.code);
      this.cbs.onStatus('Conectado');
    }
  }

  send(msg: NetMessage): void {
    if (!this.conn?.open) return;
    this.conn.send(msg);
  }

  async destroy(): Promise<void> {
    this.conn?.close();
    this.conn = null;
    if (this.peer) {
      this.peer.destroy();
      this.peer = null;
    }
    this.role = null;
    this.code = null;
  }
}
