import './styles.css';
import { MusicSynth } from './audio/music';
import { Sfx } from './audio/sfx';
import { GameEngine } from './game/engine';
import { InputController } from './game/input';
import { isSelfBuff, POWERUPS } from './game/powerups';
import { PeerRoom } from './net/peerRoom';
import type { NetMessage } from './net/protocol';
import { Renderer } from './render/renderer';
import { activeEffectLabels, updateHud } from './ui/hud';
import { renderAppShell, showScreen } from './ui/screens';

type AppMode = 'menu' | 'solo' | 'versus';

const app = document.querySelector<HTMLElement>('#app')!;
renderAppShell(app);

const music = new MusicSynth();
const sfx = new Sfx();
const input = new InputController();
const unbindKeys = input.bind();

let mode: AppMode = 'menu';
let engine: GameEngine | null = null;
let renderer: Renderer | null = null;
let raf = 0;
let last = 0;
let muted = false;
let room: PeerRoom | null = null;
let versusSeed = 0;
let rivalBoard: number[] | null = null;
let rivalScore = 0;
let rivalBlind = false;
let rivalBlindUntil = 0;
let gameRunning = false;
let pendingRematch = false;
let lastStateSend = 0;
let versusStarted = false;

const boardCanvas = () => document.getElementById('board') as HTMLCanvasElement;

function setMute(next: boolean): void {
  muted = next;
  music.setMuted(muted);
  sfx.muted = muted;
  const label = muted ? 'Sonido: OFF' : 'Sonido: ON';
  const menuMute = document.getElementById('menuMute');
  const gameMute = document.getElementById('gameMute');
  if (menuMute) menuMute.textContent = label;
  if (gameMute) gameMute.textContent = muted ? 'mute' : '♪';
}

function unlockAudio(): void {
  music.start();
  music.setMuted(muted);
}

const UI_SCALE_MIN = 0.7;
const UI_SCALE_MAX = 1.25;
const UI_SCALE_STEP = 0.1;
const UI_SCALE_KEY = 'vstetr-ui-scale';

let uiScale = loadUiScale();

function loadUiScale(): number {
  const raw = Number(localStorage.getItem(UI_SCALE_KEY));
  if (!Number.isFinite(raw)) return 1;
  return Math.min(UI_SCALE_MAX, Math.max(UI_SCALE_MIN, Math.round(raw * 10) / 10));
}

function applyUiScale(): void {
  document.documentElement.style.setProperty('--ui-scale', String(uiScale));
  const label = document.getElementById('uiZoomLabel');
  if (label) label.textContent = `${Math.round(uiScale * 100)}%`;
  renderer?.resize(cellSize());
}

function bumpUiScale(delta: number): void {
  uiScale = Math.min(
    UI_SCALE_MAX,
    Math.max(UI_SCALE_MIN, Math.round((uiScale + delta) * 10) / 10),
  );
  localStorage.setItem(UI_SCALE_KEY, String(uiScale));
  applyUiScale();
  sfx.ui();
}

function cellSize(): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  if (w <= 860) {
    // Leave room for HUD + powerups + fixed touch pad (scales with UI zoom)
    const touchBudget = 150 * uiScale;
    const hudBudget = 90 * uiScale;
    const availW = Math.min(w - 24, 360) * uiScale;
    const availH = h - touchBudget - hudBudget - 24;
    const byW = Math.floor(availW / 10);
    const byH = Math.floor(Math.max(160, availH) / 20);
    return Math.max(12, Math.min(30, byW, byH));
  }
  return 30;
}

function setVersusUI(on: boolean): void {
  document.getElementById('rivalBlock')?.classList.toggle('hidden', !on);
  document.getElementById('rivalBlockMobile')?.classList.toggle('hidden', !on);
  document.getElementById('gameLayout')?.classList.toggle('versus', on);
}

function drawRivalViews(board: number[] | null, blind: boolean): void {
  if (!renderer) return;
  const desk = document.getElementById('rivalBoard') as HTMLCanvasElement | null;
  const mob = document.getElementById('rivalBoardMobile') as HTMLCanvasElement | null;
  if (desk) renderer.drawMini(board, desk, blind);
  if (mob) renderer.drawMini(board, mob, blind);
}

function stopLoop(): void {
  gameRunning = false;
  if (raf) cancelAnimationFrame(raf);
  raf = 0;
  input.setEnabled(false);
  engine = null;
}

function startEngine(gameMode: 'solo' | 'versus', seed: number): void {
  stopLoop();
  showScreen('game');
  setVersusUI(gameMode === 'versus');
  mode = gameMode;

  const canvas = boardCanvas();
  renderer = new Renderer(canvas, cellSize());

  engine = new GameEngine(gameMode, seed, {
    onMove: () => sfx.move(),
    onRotate: () => sfx.rotate(),
    onLock: () => sfx.lock(),
    onHardDrop: () => sfx.hardDrop(),
    onHold: () => sfx.hold(),
    onClear: (info) => {
      if (info.tSpin !== 'none') sfx.tSpin(info.tSpin === 'full');
      else if (info.count > 0) sfx.line(info.count);
      if (info.count > 0) {
        renderer?.triggerClear(info.lines, engine!.board, {
          tSpin: info.tSpin !== 'none',
          label: info.label,
        });
      } else if (info.label) {
        renderer?.triggerBanner(info.label, true);
      }
    },
    onTSpin: () => {
      /* sound handled in onClear */
    },
    onPowerupGain: () => sfx.powerupGain(),
    onLevel: (lv) => music.setIntensity(0.8 + lv * 0.12),
    onGameOver: () => handleLocalGameOver(),
  });

  input.attach(engine, (slot) => usePowerup(slot));
  input.setEnabled(false);

  music.setIntensity(gameMode === 'versus' ? 1.4 : 1);
  music.start();

  void runCountdown().then(() => {
    if (!engine) return;
    input.setEnabled(true);
    gameRunning = true;
    last = performance.now();
    raf = requestAnimationFrame(loop);
  });
}

async function runCountdown(): Promise<void> {
  const el = document.getElementById('countdown');
  if (!el) return;
  el.classList.remove('hidden');
  for (const n of ['3', '2', '1', '¡YA!']) {
    el.textContent = n;
    if (n === '¡YA!') sfx.go();
    else sfx.countdown();
    await wait(n === '¡YA!' ? 450 : 700);
  }
  el.classList.add('hidden');
}

function wait(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

function loop(now: number): void {
  if (!gameRunning || !engine || !renderer) return;
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;

  input.update(dt);
  engine.update(dt);
  renderer.update(dt);

  const snap = engine.snapshot();
  const blind = performance.now() < snap.effects.blindUntil;
  renderer.draw(snap, { blind });

  updateHud(app, snap, {
    rivalScore,
    effectLabels: activeEffectLabels(snap),
  });

  if (mode === 'versus') {
    if (performance.now() > rivalBlindUntil) rivalBlind = false;
    drawRivalViews(rivalBoard, rivalBlind);
    if (now - lastStateSend > 80) {
      lastStateSend = now;
      room?.send({
        t: 'state',
        board: engine.liteBoard(),
        score: engine.score,
        lines: engine.lines,
        level: engine.level,
        alive: !engine.gameOver,
      });
    }
  }

  raf = requestAnimationFrame(loop);
}

function usePowerup(slot: number): void {
  if (!engine || engine.gameOver) return;
  const id = engine.useSlot(slot);
  if (!id) return;

  if (isSelfBuff(id)) {
    sfx.powerupSend();
    return;
  }

  if (mode === 'solo') {
    sfx.powerupSend();
    return;
  }

  // versus debuff -> send to rival
  sfx.powerupSend();
  if (id === 'garbage') {
    room?.send({
      t: 'attack',
      id,
      rows: POWERUPS.garbage.garbageRows ?? 2,
      hole: Math.floor(Math.random() * 10),
    });
  } else {
    room?.send({ t: 'attack', id });
  }
  if (id === 'blind') {
    rivalBlind = true;
    rivalBlindUntil = performance.now() + 4000;
  }
}

function handleLocalGameOver(): void {
  sfx.ko();
  input.setEnabled(false);
  if (mode === 'versus') {
    room?.send({ t: 'gameOver', winner: 'rival' });
    endMatch('Derrota', 'Tu torre colapsó.');
  } else {
    endMatch('Game Over', `Puntos ${engine?.score ?? 0} · Líneas ${engine?.lines ?? 0}`);
  }
}

function endMatch(title: string, sub: string): void {
  gameRunning = false;
  const t = document.getElementById('resultTitle');
  const s = document.getElementById('resultSub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
  showScreen('result');
}

function ensureRoom(): PeerRoom {
  // Always fresh instance (avoids stale PeerJS/MQTT state after failed joins)
  void room?.destroy();
  room = new PeerRoom({
    onStatus: (text) => {
      const el = document.getElementById('roomStatus');
      if (el) el.textContent = text;
    },
    onConnected: (role, code) => {
      document.getElementById('roomCodeDisplay')?.classList.remove('hidden');
      const val = document.getElementById('roomCodeValue');
      if (val) val.textContent = code;
      if (role === 'host') {
        versusSeed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
        room?.send({ t: 'hello', seed: versusSeed, name: 'host' });
      } else {
        room?.send({ t: 'ready' });
      }
    },
    onMessage: onNetMessage,
    onDisconnected: () => {
      if (mode === 'versus' && gameRunning) {
        endMatch('Desconectado', 'El rival cerró la conexión.');
      }
      const el = document.getElementById('roomStatus');
      if (el) el.textContent = 'Desconectado';
    },
    onError: (err) => {
      const el = document.getElementById('roomStatus');
      if (el) el.textContent = `Error: ${err}`;
    },
  });
  return room;
}

function onNetMessage(msg: NetMessage): void {
  switch (msg.t) {
    case 'hello':
      versusSeed = msg.seed;
      room?.send({ t: 'ready' });
      if (room?.role === 'host') {
        // guest will ready; host starts
      }
      break;
    case 'ready':
      if (room?.role === 'host' && !versusStarted) {
        if (!versusSeed) versusSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
        versusStarted = true;
        room.send({ t: 'start', at: Date.now() + 300, seed: versusSeed });
        void beginVersus(versusSeed);
      }
      break;
    case 'start':
      if (!versusStarted) {
        versusSeed = msg.seed;
        versusStarted = true;
        void beginVersus(msg.seed);
      }
      break;
    case 'state':
      rivalBoard = msg.board;
      rivalScore = msg.score;
      break;
    case 'attack':
      if (!engine) return;
      sfx.powerupHit();
      engine.receiveAttack(msg.id, { rows: msg.rows, hole: msg.hole });
      break;
    case 'gameOver':
      if (msg.winner === 'rival') {
        // opponent says they lost -> we win. But message says winner from their POV:
        // they send winner:'rival' meaning the other player (us) won
        endMatch('¡Victoria!', 'El rival ha caído.');
      } else {
        endMatch('Derrota', 'El rival ganó.');
      }
      break;
    case 'rematch':
      pendingRematch = true;
      versusStarted = false;
      void beginVersus((versusSeed + 1) >>> 0);
      break;
  }
}

async function beginVersus(seed: number): Promise<void> {
  rivalBoard = null;
  rivalScore = 0;
  rivalBlind = false;
  pendingRematch = false;
  versusStarted = true;
  unlockAudio();
  startEngine('versus', seed);
}

async function createRoom(): Promise<void> {
  unlockAudio();
  sfx.ui();
  versusStarted = false;
  versusSeed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
  const r = ensureRoom();
  try {
    const code = await r.host();
    document.getElementById('roomCodeDisplay')?.classList.remove('hidden');
    const val = document.getElementById('roomCodeValue');
    if (val) val.textContent = code;
  } catch (e) {
    const el = document.getElementById('roomStatus');
    if (el) el.textContent = `No se pudo crear la sala: ${String(e)}`;
  }
}

async function joinRoom(): Promise<void> {
  unlockAudio();
  sfx.ui();
  versusStarted = false;
  const inputEl = document.getElementById('roomCodeInput') as HTMLInputElement;
  const code = inputEl?.value ?? '';
  const r = ensureRoom();
  try {
    await r.join(code);
  } catch (e) {
    const el = document.getElementById('roomStatus');
    const msg = e instanceof Error ? e.message : String(e);
    if (el) {
      el.textContent = msg.includes('peer')
        ? 'Versión antigua en caché. Recarga con Ctrl+Shift+R (o borra caché) en AMBOS dispositivos.'
        : `No se pudo unir: ${msg}`;
    }
  }
}

function exitToMenu(): void {
  stopLoop();
  music.stop();
  void room?.destroy();
  room = null;
  mode = 'menu';
  showScreen('menu');
}

app.addEventListener('click', (e) => {
  const t = (e.target as HTMLElement).closest<HTMLElement>('[data-action], [data-touch]');
  if (!t) return;

  const touch = t.dataset.touch;
  if (touch) {
    if (touch === 'left' || touch === 'right' || touch === 'soft') return;
    if (touch === 'rotCW') input.tap('rotCW');
    if (touch === 'hard') input.tap('hard');
    if (touch === 'hold') input.tap('hold');
    return;
  }

  const action = t.dataset.action;
  switch (action) {
    case 'solo':
      unlockAudio();
      sfx.ui();
      startEngine('solo', Date.now());
      break;
    case 'versus':
      sfx.ui();
      showScreen('versus-setup');
      break;
    case 'back-menu':
      exitToMenu();
      break;
    case 'create-room':
      void createRoom();
      break;
    case 'join-room':
      void joinRoom();
      break;
    case 'copy-code': {
      const code = document.getElementById('roomCodeValue')?.textContent ?? '';
      void navigator.clipboard?.writeText(code);
      sfx.ui();
      break;
    }
    case 'toggle-mute':
      setMute(!muted);
      unlockAudio();
      break;
    case 'ui-zoom-in':
      bumpUiScale(UI_SCALE_STEP);
      break;
    case 'ui-zoom-out':
      bumpUiScale(-UI_SCALE_STEP);
      break;
    case 'exit-game':
      exitToMenu();
      break;
    case 'use-pu': {
      const i = Number(t.dataset.i ?? -1);
      if (i >= 0) usePowerup(i);
      break;
    }
    case 'again':
      if (mode === 'versus' || room?.role) {
        room?.send({ t: 'rematch' });
        versusStarted = false;
        if (pendingRematch || room?.role === 'host') {
          void beginVersus((versusSeed + 17) >>> 0);
        } else {
          const sub = document.getElementById('resultSub');
          if (sub) sub.textContent = 'Esperando rematch…';
        }
      } else {
        startEngine('solo', Date.now());
      }
      break;
  }
});

// Touch hold for move/soft
for (const dir of ['left', 'right', 'soft'] as const) {
  app.addEventListener('pointerdown', (e) => {
    const t = (e.target as HTMLElement).closest<HTMLElement>(`[data-touch="${dir}"]`);
    if (!t) return;
    e.preventDefault();
    input.setHeld(dir, true);
  });
}
window.addEventListener('pointerup', () => {
  input.setHeld('left', false);
  input.setHeld('right', false);
  input.setHeld('soft', false);
});
window.addEventListener('pointercancel', () => {
  input.setHeld('left', false);
  input.setHeld('right', false);
  input.setHeld('soft', false);
});

window.addEventListener('resize', () => {
  renderer?.resize(cellSize());
});

window.addEventListener('beforeunload', () => {
  unbindKeys();
  void room?.destroy();
});

applyUiScale();
showScreen('menu');
