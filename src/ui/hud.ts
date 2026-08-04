import type { PieceId } from '../game/constants';
import type { EngineSnapshot } from '../game/engine';
import { POWERUPS } from '../game/powerups';
import { SHAPES } from '../game/pieces';
import { colorFor } from '../render/themes';

let lastScore = -1;
let lastLevel = -1;

export function updateHud(
  root: HTMLElement,
  snap: EngineSnapshot,
  extra: {
    rivalScore?: number;
    effectLabels?: string[];
  } = {},
): void {
  const bump = (sel: string, text: string, changed: boolean) => {
    const el = root.querySelector(sel);
    if (!el) return;
    if (el.textContent !== text) el.textContent = text;
    if (changed) {
      el.classList.remove('stat-bump');
      void (el as HTMLElement).offsetWidth;
      el.classList.add('stat-bump');
    }
  };
  bump('[data-score]', String(snap.score), snap.score !== lastScore && lastScore >= 0);
  bump('[data-lines]', String(snap.lines), false);
  bump('[data-level]', String(snap.level), snap.level !== lastLevel && lastLevel >= 0);
  lastScore = snap.score;
  lastLevel = snap.level;
  if (extra.rivalScore !== undefined) {
    const set = (sel: string, text: string) => {
      const el = root.querySelector(sel);
      if (el) el.textContent = text;
    };
    set('[data-rival-score]', String(extra.rivalScore));
    set('[data-rival-score-m]', String(extra.rivalScore));
  }

  const effects = root.querySelector('[data-effects]');
  if (effects) {
    const labels = extra.effectLabels ?? [];
    effects.innerHTML = labels.map((l) => `<span class="effect-chip">${l}</span>`).join('');
  }

  const slots = root.querySelectorAll('[data-slot]');
  slots.forEach((el, i) => {
    const id = snap.slots[i];
    const btn = el as HTMLElement;
    const wasFilled = btn.classList.contains('filled');
    btn.classList.toggle('filled', !!id);
    if (id && !wasFilled) {
      btn.classList.remove('pu-gain');
      void btn.offsetWidth;
      btn.classList.add('pu-gain');
    }
    if (id) {
      const def = POWERUPS[id];
      btn.style.setProperty('--pu', def.color);
      btn.innerHTML = `<span class="pu-short">${def.short}</span><span class="pu-name">${def.label}</span>`;
      btn.title = def.desc;
    } else {
      btn.style.removeProperty('--pu');
      btn.innerHTML = `<span class="pu-empty">${i + 1}</span>`;
      btn.title = 'Vacío';
    }
  });

  drawSidePreview(root.querySelector('#holdCanvas') as HTMLCanvasElement | null, snap.hold);
  const nextCanvases = root.querySelectorAll<HTMLCanvasElement>('[data-next]');
  nextCanvases.forEach((c, i) => drawSidePreview(c, snap.next[i] ?? null));
}

function drawSidePreview(canvas: HTMLCanvasElement | null, id: PieceId | null): void {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const size = 22;
  canvas.width = size * 4;
  canvas.height = size * 4;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (!id) return;
  const shape = SHAPES[id][0];
  const { fill } = colorFor(id);
  ctx.fillStyle = fill;
  ctx.shadowColor = fill;
  ctx.shadowBlur = 8;
  for (const [x, y] of shape) {
    ctx.fillRect(x * size + 2, y * size + 2, size - 3, size - 3);
  }
}

export function activeEffectLabels(snap: EngineSnapshot): string[] {
  const now = performance.now();
  const labels: string[] = [];
  if (now < snap.effects.blindUntil) labels.push('CEGUERA');
  if (now < snap.effects.slowUntil) labels.push('LENTO');
  if (now < snap.effects.speedUntil) labels.push('TURBO');
  if (now < snap.effects.invertUntil) labels.push('ESPEJO');
  if (now < snap.effects.stainUntil) labels.push('MANCHAS');
  if (now < snap.effects.rushUntil) labels.push('ACELERA');
  return labels;
}
