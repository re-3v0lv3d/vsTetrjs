import { ARR_MS, DAS_MS } from './constants';
import type { GameEngine } from './engine';

type Action =
  | 'left'
  | 'right'
  | 'soft'
  | 'hard'
  | 'rotCW'
  | 'rotCCW'
  | 'hold'
  | 'pause'
  | 'pu0'
  | 'pu1'
  | 'pu2';

const KEY_MAP: Record<string, Action> = {
  ArrowLeft: 'left',
  ArrowRight: 'right',
  ArrowDown: 'soft',
  ArrowUp: 'rotCW',
  x: 'rotCW',
  X: 'rotCW',
  z: 'rotCCW',
  Z: 'rotCCW',
  ' ': 'hard',
  c: 'hold',
  C: 'hold',
  Escape: 'pause',
  '1': 'pu0',
  '2': 'pu1',
  '3': 'pu2',
};

export class InputController {
  private held = new Set<Action>();
  private das: Partial<Record<'left' | 'right', number>> = {};
  private arr: Partial<Record<'left' | 'right', number>> = {};
  private engine: GameEngine | null = null;
  private onPowerup: ((slot: number) => void) | null = null;
  private enabled = true;

  attach(engine: GameEngine, onPowerup?: (slot: number) => void): void {
    this.engine = engine;
    this.onPowerup = onPowerup ?? null;
  }

  setEnabled(v: boolean): void {
    this.enabled = v;
    if (!v) {
      this.held.clear();
      this.engine?.setSoftDrop(false);
    }
  }

  bind(): () => void {
    const down = (e: KeyboardEvent) => {
      if (!this.enabled || !this.engine) return;
      const action = KEY_MAP[e.key];
      if (!action) return;
      if (['ArrowLeft', 'ArrowRight', 'ArrowDown', 'ArrowUp', ' '].includes(e.key)) {
        e.preventDefault();
      }
      if (this.held.has(action)) return;
      this.held.add(action);
      this.trigger(action, true);
    };
    const up = (e: KeyboardEvent) => {
      const action = KEY_MAP[e.key];
      if (!action) return;
      this.held.delete(action);
      this.trigger(action, false);
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
    };
  }

  private trigger(action: Action, pressed: boolean): void {
    const eng = this.engine;
    if (!eng) return;

    if (action === 'soft') {
      eng.setSoftDrop(pressed);
      return;
    }
    if (!pressed) {
      if (action === 'left' || action === 'right') {
        delete this.das[action];
        delete this.arr[action];
      }
      return;
    }

    switch (action) {
      case 'left':
        eng.move(-1);
        this.das.left = 0;
        break;
      case 'right':
        eng.move(1);
        this.das.right = 0;
        break;
      case 'rotCW':
        eng.rotate(1);
        break;
      case 'rotCCW':
        eng.rotate(-1);
        break;
      case 'hard':
        eng.hardDrop();
        break;
      case 'hold':
        eng.holdPiece();
        break;
      case 'pause':
        eng.togglePause();
        break;
      case 'pu0':
        this.onPowerup?.(0);
        break;
      case 'pu1':
        this.onPowerup?.(1);
        break;
      case 'pu2':
        this.onPowerup?.(2);
        break;
    }
  }

  /** Call each frame with dt seconds */
  update(dt: number): void {
    if (!this.enabled || !this.engine) return;
    for (const dir of ['left', 'right'] as const) {
      if (!this.held.has(dir)) continue;
      this.das[dir] = (this.das[dir] ?? 0) + dt * 1000;
      if ((this.das[dir] ?? 0) < DAS_MS) continue;
      this.arr[dir] = (this.arr[dir] ?? 0) + dt * 1000;
      while ((this.arr[dir] ?? 0) >= ARR_MS) {
        this.arr[dir]! -= ARR_MS;
        this.engine.move(dir === 'left' ? -1 : 1);
      }
    }
  }

  tap(action: Action): void {
    if (!this.enabled) return;
    this.trigger(action, true);
    this.trigger(action, false);
  }

  setHeld(action: 'left' | 'right' | 'soft', pressed: boolean): void {
    if (pressed) {
      if (!this.held.has(action)) {
        this.held.add(action);
        this.trigger(action, true);
      }
    } else {
      this.held.delete(action);
      this.trigger(action, false);
    }
  }
}
