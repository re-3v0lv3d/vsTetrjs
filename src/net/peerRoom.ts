import mqtt, { type MqttClient } from 'mqtt';
import { decode, generateRoomCode, type NetMessage } from './protocol';

export type RoomRole = 'host' | 'guest';

export interface RoomCallbacks {
  onStatus: (text: string) => void;
  onConnected: (role: RoomRole, code: string) => void;
  onMessage: (msg: NetMessage) => void;
  onDisconnected: () => void;
  onError: (err: string) => void;
}

/** Public MQTT brokers (WebSocket) — works across the internet, no TURN needed */
const BROKERS = [
  import.meta.env.VITE_MQTT_URL,
  'wss://broker.emqx.io:8084/mqtt',
  'wss://test.mosquitto.org:8081/mqtt',
].filter((u): u is string => !!u);

type Wire =
  | { v: 1; from: string; kind: 'join' | 'bye' | 'hb' }
  | { v: 1; from: string; kind: 'game'; payload: NetMessage; mid?: string };

function topicFor(code: string): string {
  return `vstetr/v2/room/${code.toUpperCase()}`;
}

function reliable(msg: NetMessage): boolean {
  return msg.t !== 'state' && msg.t !== 'ping' && msg.t !== 'pong';
}

export class PeerRoom {
  private client: MqttClient | null = null;
  private selfId = '';
  private topic = '';
  private linked = false;
  private hbTimer: number | null = null;
  private lastPeerHb = 0;
  private watchTimer: number | null = null;
  private queue: NetMessage[] = [];
  private seen = new Set<string>();
  role: RoomRole | null = null;
  code: string | null = null;
  private cbs: RoomCallbacks;

  constructor(cbs: RoomCallbacks) {
    this.cbs = cbs;
  }

  get connected(): boolean {
    return !!this.client?.connected;
  }

  async host(): Promise<string> {
    await this.destroy();
    const code = generateRoomCode();
    this.role = 'host';
    this.code = code;
    this.cbs.onStatus('Conectando al servidor…');
    await this.connectMqtt(code);
    this.cbs.onStatus(`Sala ${code} — esperando rival…`);
    return code;
  }

  async join(code: string): Promise<void> {
    await this.destroy();
    const clean = code.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
    if (clean.length < 4) throw new Error('Código inválido');
    this.role = 'guest';
    this.code = clean;
    this.cbs.onStatus('Conectando al servidor…');
    await this.connectMqtt(clean);
    this.publishSys('join');
    this.cbs.onStatus('Buscando anfitrión…');

    await new Promise<void>((resolve, reject) => {
      const started = performance.now();
      const iv = window.setInterval(() => {
        if (this.linked) {
          clearInterval(iv);
          resolve();
          return;
        }
        if (performance.now() - started > 20000) {
          clearInterval(iv);
          reject(new Error('No se encontró la sala (¿código correcto? ¿el host sigue esperando?)'));
          return;
        }
        this.publishSys('join');
        this.cbs.onStatus('Buscando anfitrión…');
      }, 1000);
    });
  }

  private async connectMqtt(code: string): Promise<void> {
    this.selfId = `p_${Math.random().toString(36).slice(2, 10)}`;
    this.topic = topicFor(code);
    this.linked = false;
    this.queue = [];
    this.seen.clear();

    let lastErr: unknown;
    for (const url of BROKERS) {
      try {
        await this.tryBroker(url);
        return;
      } catch (e) {
        lastErr = e;
        this.client?.end(true);
        this.client = null;
      }
    }
    throw new Error(`No hay broker MQTT disponible: ${String(lastErr)}`);
  }

  private tryBroker(url: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const client = mqtt.connect(url, {
        clientId: `vstetr_${this.selfId}`,
        clean: true,
        reconnectPeriod: 2000,
        connectTimeout: 10000,
        protocolVersion: 4,
      });
      this.client = client;

      const t = window.setTimeout(() => {
        client.end(true);
        reject(new Error(`Timeout ${url}`));
      }, 12000);

      client.on('connect', () => {
        client.subscribe(this.topic, { qos: 1 }, (err) => {
          if (err) {
            clearTimeout(t);
            reject(err);
            return;
          }
          clearTimeout(t);
          this.startHeartbeat();
          this.flushQueue();
          resolve();
        });
      });

      client.on('reconnect', () => {
        this.flushQueue();
      });

      client.on('message', (_topic, buf) => {
        this.onRaw(buf.toString());
      });

      client.on('error', (err) => {
        this.cbs.onError(String(err.message || err));
      });

      client.on('close', () => {
        if (this.linked) {
          this.linked = false;
          this.cbs.onDisconnected();
        }
      });
    });
  }

  private onRaw(raw: string): void {
    let data: Wire;
    try {
      data = JSON.parse(raw) as Wire;
    } catch {
      const legacy = decode(raw);
      if (legacy) this.cbs.onMessage(legacy);
      return;
    }
    if (!data || data.v !== 1 || data.from === this.selfId) return;

    if (data.kind === 'hb' || data.kind === 'join') {
      this.lastPeerHb = performance.now();
      if (data.kind === 'join' && this.role === 'host') this.markLinked();
      if (data.kind === 'hb' && this.role === 'guest') this.markLinked();
      return;
    }

    if (data.kind === 'bye') {
      this.cbs.onDisconnected();
      return;
    }

    if (data.kind === 'game') {
      this.lastPeerHb = performance.now();
      this.markLinked();
      if (data.mid) {
        if (this.seen.has(data.mid)) return;
        this.seen.add(data.mid);
        if (this.seen.size > 80) {
          const first = this.seen.values().next().value;
          if (first) this.seen.delete(first);
        }
      }
      this.cbs.onMessage(data.payload);
    }
  }

  private markLinked(): void {
    if (this.linked || !this.role || !this.code) return;
    this.linked = true;
    this.lastPeerHb = performance.now();
    this.cbs.onConnected(this.role, this.code);
    this.cbs.onStatus('Conectado');
    this.flushQueue();
  }

  private publishSys(kind: 'join' | 'bye' | 'hb'): void {
    if (!this.client?.connected) return;
    const wire: Wire = { v: 1, from: this.selfId, kind };
    this.client.publish(this.topic, JSON.stringify(wire), { qos: kind === 'hb' ? 0 : 1 });
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.hbTimer = window.setInterval(() => {
      this.publishSys('hb');
    }, 2500);
    this.watchTimer = window.setInterval(() => {
      if (!this.linked) return;
      if (performance.now() - this.lastPeerHb > 12000) {
        this.cbs.onStatus('Rival sin señal…');
        this.cbs.onDisconnected();
        this.linked = false;
      }
    }, 3000);
  }

  private stopHeartbeat(): void {
    if (this.hbTimer !== null) {
      clearInterval(this.hbTimer);
      this.hbTimer = null;
    }
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
  }

  private flushQueue(): void {
    if (!this.client?.connected || this.queue.length === 0) return;
    const pending = this.queue.splice(0);
    for (const msg of pending) this.publishGame(msg);
  }

  private publishGame(msg: NetMessage, copies = 1): void {
    if (!this.client?.connected) {
      this.queue.push(msg);
      return;
    }
    const mid =
      reliable(msg) && msg.t !== 'hello' && msg.t !== 'ready' && msg.t !== 'start'
        ? `${this.selfId}_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`
        : undefined;
    const wire: Wire = { v: 1, from: this.selfId, kind: 'game', payload: msg, mid };
    const body = JSON.stringify(wire);
    const qos = reliable(msg) ? 1 : 0;
    for (let i = 0; i < copies; i++) {
      this.client.publish(this.topic, body, { qos });
    }
  }

  send(msg: NetMessage): void {
    // Attacks: triple-send for flaky public brokers (deduped by mid on receive)
    const copies = msg.t === 'attack' ? 3 : 1;
    this.publishGame(msg, copies);
  }

  async destroy(): Promise<void> {
    this.stopHeartbeat();
    if (this.client?.connected) {
      try {
        this.publishSys('bye');
      } catch {
        /* ignore */
      }
    }
    this.client?.end(true);
    this.client = null;
    this.linked = false;
    this.role = null;
    this.code = null;
    this.topic = '';
    this.queue = [];
    this.seen.clear();
  }
}
