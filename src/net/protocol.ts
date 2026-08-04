import type { PowerupId } from '../game/powerups';

export function generateRoomCode(): string {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export type NetMessage =
  | { t: 'hello'; seed: number; name: string }
  | { t: 'ready' }
  | { t: 'start'; at: number; seed: number }
  | { t: 'state'; board: number[]; score: number; lines: number; level: number; alive: boolean }
  | { t: 'attack'; id: PowerupId; rows?: number; hole?: number }
  | { t: 'gameOver'; winner: 'self' | 'rival' }
  | { t: 'rematch' }
  | { t: 'ping'; n: number }
  | { t: 'pong'; n: number };

export function encode(msg: NetMessage): string {
  return JSON.stringify(msg);
}

export function decode(raw: string): NetMessage | null {
  try {
    const data = JSON.parse(raw) as NetMessage;
    if (!data || typeof data !== 'object' || !('t' in data)) return null;
    return data;
  } catch {
    return null;
  }
}
