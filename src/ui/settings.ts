const KEY = 'vstetr-settings-v1';

export interface Settings {
  music: number; // 0–1
  sfx: number; // 0–1
  uiScale: number;
  particles: number; // 0–1
  shake: number; // 0–1
  pulse: number; // 0–1
  ghost: boolean;
}

const DEFAULTS: Settings = {
  music: 0.85,
  sfx: 0.9,
  uiScale: 1,
  particles: 1,
  shake: 1,
  pulse: 1,
  ghost: true,
};

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    const parsed = JSON.parse(raw) as Partial<Settings>;
    return {
      music: clamp01(parsed.music ?? DEFAULTS.music),
      sfx: clamp01(parsed.sfx ?? DEFAULTS.sfx),
      uiScale: clamp(parsed.uiScale ?? DEFAULTS.uiScale, 0.7, 1.25),
      particles: clamp01(parsed.particles ?? DEFAULTS.particles),
      shake: clamp01(parsed.shake ?? DEFAULTS.shake),
      pulse: clamp01(parsed.pulse ?? DEFAULTS.pulse),
      ghost: parsed.ghost ?? DEFAULTS.ghost,
    };
  } catch {
    return { ...DEFAULTS };
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(KEY, JSON.stringify(s));
}

export function defaults(): Settings {
  return { ...DEFAULTS };
}

function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

export function bindSettingsForm(
  root: HTMLElement,
  current: Settings,
  onChange: (next: Settings) => void,
): void {
  const syncLabels = (s: Settings) => {
    const pct = (v: number) => `${Math.round(v * 100)}%`;
    setText(root, '[data-val="music"]', pct(s.music));
    setText(root, '[data-val="sfx"]', pct(s.sfx));
    setText(root, '[data-val="uiScale"]', pct(s.uiScale));
    setText(root, '[data-val="particles"]', pct(s.particles));
    setText(root, '[data-val="shake"]', pct(s.shake));
    setText(root, '[data-val="pulse"]', pct(s.pulse));
  };

  const read = (): Settings => {
    const num = (name: string, fallback: number) => {
      const el = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
      return el ? Number(el.value) : fallback;
    };
    const ghostEl = root.querySelector<HTMLInputElement>('[name="ghost"]');
    return {
      music: clamp01(num('music', current.music) / 100),
      sfx: clamp01(num('sfx', current.sfx) / 100),
      uiScale: clamp(num('uiScale', current.uiScale * 100) / 100, 0.7, 1.25),
      particles: clamp01(num('particles', current.particles) / 100),
      shake: clamp01(num('shake', current.shake) / 100),
      pulse: clamp01(num('pulse', current.pulse) / 100),
      ghost: ghostEl?.checked ?? true,
    };
  };

  const applyToInputs = (s: Settings) => {
    const set = (name: string, value: string | number | boolean) => {
      const el = root.querySelector<HTMLInputElement>(`[name="${name}"]`);
      if (!el) return;
      if (el.type === 'checkbox') el.checked = Boolean(value);
      else el.value = String(value);
    };
    set('music', Math.round(s.music * 100));
    set('sfx', Math.round(s.sfx * 100));
    set('uiScale', Math.round(s.uiScale * 100));
    set('particles', Math.round(s.particles * 100));
    set('shake', Math.round(s.shake * 100));
    set('pulse', Math.round(s.pulse * 100));
    set('ghost', s.ghost);
    syncLabels(s);
  };

  applyToInputs(current);

  root.querySelectorAll('input').forEach((el) => {
    el.addEventListener('input', () => {
      const next = read();
      syncLabels(next);
      onChange(next);
    });
  });

  root.querySelector('[data-action="reset-settings"]')?.addEventListener('click', () => {
    const d = defaults();
    applyToInputs(d);
    onChange(d);
  });
}

function setText(root: HTMLElement, sel: string, text: string): void {
  const el = root.querySelector(sel);
  if (el) el.textContent = text;
}
