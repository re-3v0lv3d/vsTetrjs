import './styles.css';
import { MusicSynth } from './audio/music';
import { Sfx } from './audio/sfx';
import { GameEngine } from './game/engine';
import { InputController } from './game/input';
import { formatTime, modeLabel, type SoloKind } from './game/modes';
import { isSelfBuff, POWERUPS, type PowerupId } from './game/powerups';
import { PeerRoom } from './net/peerRoom';
import type { NetMessage } from './net/protocol';
import { Renderer } from './render/renderer';
import { activeEffectLabels, flashComboBurst, updateHud } from './ui/hud';
import { MenuFx } from './ui/menuFx';
import { bindSettingsForm, loadSettings, saveSettings, type Settings } from './ui/settings';
import { renderAppShell, showScreen, type ScreenId } from './ui/screens';

type AppMode = 'menu' | 'solo' | 'versus';

const app = document.querySelector<HTMLElement>('#app')!;
renderAppShell(app);

const music = new MusicSynth();
const sfx = new Sfx();
const input = new InputController();
const unbindKeys = input.bind();

let settings: Settings = loadSettings();
let mode: AppMode = 'menu';
let soloKind: SoloKind = 'marathon';
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
let lastStateSend = 0;
let versusStarted = false;
let localReady = false;
let rivalReady = false;
let iWantRematch = false;
let rivalWantsRematch = false;
let pingRtt: number | null = null;
let pingSeq = 0;
let lastPingSent: { n: number; t: number } | null = null;
let lastPingAt = 0;
let linkOk = false;
let endingCinematic = false;

const boardCanvas = () => document.getElementById('board') as HTMLCanvasElement;
const menuFxCanvas = document.getElementById('menuFx') as HTMLCanvasElement;
const menuFx = new MenuFx(menuFxCanvas);

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
  music.unlock();
  music.setMuted(muted);
  music.setVolume(settings.music);
}

function applySettings(next: Settings, persist = true): void {
  settings = next;
  if (persist) saveSettings(settings);
  music.setVolume(settings.music);
  sfx.setVolume(settings.sfx);
  document.documentElement.style.setProperty('--ui-scale', String(settings.uiScale));
  const label = document.getElementById('uiZoomLabel');
  if (label) label.textContent = `${Math.round(settings.uiScale * 100)}%`;
  if (renderer) {
    renderer.particlesAmount = settings.particles;
    renderer.shakeAmount = settings.shake;
    renderer.pulseAmount = settings.pulse;
    renderer.showGhost = settings.ghost;
    renderer.resize(cellSize());
  }
}

function bumpUiScale(delta: number): void {
  const next = {
    ...settings,
    uiScale: Math.min(1.25, Math.max(0.7, Math.round((settings.uiScale + delta) * 10) / 10)),
  };
  applySettings(next);
  sfx.ui();
}

function goScreen(id: ScreenId): void {
  showScreen(id);
  const menuish =
    id === 'menu' || id === 'solo-modes' || id === 'settings' || id === 'versus-setup';
  if (menuish) {
    menuFx.start();
    music.unlock();
    music.playMenu();
  } else {
    menuFx.stop();
  }
}

function openSoloModes(): void {
  unlockAudio();
  sfx.ui();
  goScreen('solo-modes');
  // Ensure the solo screen is actually visible (defensive)
  document.getElementById('screen-solo')?.classList.add('active');
  document.getElementById('screen-menu')?.classList.remove('active');
  document.body.dataset.screen = 'solo-modes';
}

function resetLobbyReady(): void {
  localReady = false;
  rivalReady = false;
  updateLobbyReadyUI();
}

function updateLobbyReadyUI(): void {
  const box = document.getElementById('lobbyReady');
  const you = document.getElementById('readyYou');
  const riv = document.getElementById('readyRival');
  const btn = document.getElementById('readyBtn');
  const hint = document.getElementById('lobbyHint');
  if (!box) return;
  const connected = !!room?.connected;
  box.classList.toggle('hidden', !connected);
  if (you) you.textContent = `Tú: ${localReady ? 'LISTO' : '…'}`;
  if (riv) riv.textContent = `Rival: ${rivalReady ? 'LISTO' : '…'}`;
  if (btn) {
    btn.textContent = localReady ? 'Esperando…' : 'Listo';
    btn.classList.toggle('btn-secondary', localReady);
    btn.classList.toggle('btn-primary', !localReady);
  }
  if (hint) {
    if (!connected) hint.textContent = 'Esperando conexión…';
    else if (localReady && rivalReady) hint.textContent = '¡Arrancando!';
    else if (localReady) hint.textContent = 'Esperando al rival…';
    else if (rivalReady) hint.textContent = 'El rival está listo. ¡Pulsa Listo!';
    else hint.textContent = 'Cuando estéis preparados, pulsad Listo.';
  }
}

function tryHostStart(): void {
  if (room?.role !== 'host' || versusStarted) return;
  if (!localReady || !rivalReady) return;
  if (!versusSeed) versusSeed = (Date.now() ^ 0x9e3779b9) >>> 0;
  versusStarted = true;
  room.send({ t: 'start', at: Date.now() + 300, seed: versusSeed });
  void beginVersus(versusSeed);
}

function tryStartRematch(): void {
  if (!iWantRematch || !rivalWantsRematch || versusStarted) return;
  if (room?.role === 'host') {
    const seed = (versusSeed + 17) >>> 0;
    versusSeed = seed;
    versusStarted = true;
    iWantRematch = false;
    rivalWantsRematch = false;
    room.send({ t: 'start', at: Date.now() + 200, seed });
    void beginVersus(seed);
  }
}

function cellSize(): number {
  const w = window.innerWidth;
  const h = window.innerHeight;
  const uiScale = settings.uiScale;
  if (w <= 860) {
    // Leave room for left rail (~30%) + HUD + touch pad
    const touchBudget = 150 * uiScale;
    const hudBudget = 78 * uiScale;
    const railFrac = 0.3;
    const availW = Math.min(w * (1 - railFrac) - 16, 340) * uiScale;
    const availH = h - touchBudget - hudBudget - 24;
    const byW = Math.floor(availW / 10);
    const byH = Math.floor(Math.max(160, availH) / 20);
    return Math.max(12, Math.min(28, byW, byH));
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

function startEngine(gameMode: 'solo' | 'versus', seed: number, kind: SoloKind | null = null): void {
  stopLoop();
  endingCinematic = false;
  goScreen('game');
  setVersusUI(gameMode === 'versus');
  mode = gameMode;
  if (gameMode === 'solo' && kind) soloKind = kind;

  const canvas = boardCanvas();
  renderer = new Renderer(canvas, cellSize());
  applySettings(settings, false);
  document.getElementById('koOverlay')?.classList.add('hidden');
  document.getElementById('netBadge')?.classList.toggle('hidden', gameMode !== 'versus');

  engine = new GameEngine(
    gameMode,
    seed,
    {
      onMove: () => sfx.move(),
      onRotate: () => sfx.rotate(),
      onLock: () => {
        sfx.place();
        renderer?.triggerLockFlash();
      },
      onHardDrop: () => sfx.hardDrop(),
      onHold: () => sfx.hold(),
      onClear: (info) => {
        const duckMs = info.tSpin !== 'none' ? 700 : 380 + info.count * 80;
        const duckAmt = info.tSpin !== 'none' ? 0.18 : Math.max(0.22, 0.4 - info.count * 0.05);
        music.duck(duckAmt, duckMs);
        if (info.tSpin !== 'none') sfx.tSpin(info.tSpin === 'full');
        else if (info.count > 0) sfx.line(info.count);
        if (info.combo >= 1) {
          sfx.combo(info.combo);
          renderer?.triggerComboPulse(info.combo);
          flashComboBurst(app, info.combo);
        }
        let label = info.label;
        if (info.combo >= 1 && info.count > 0) {
          label = `${info.label}  ·  COMBO ${info.combo}`;
        }
        if (info.count > 0) {
          renderer?.triggerClear(info.lines, engine!.board, {
            tSpin: info.tSpin !== 'none',
            label,
            lockCells: info.lockCells,
          });
        } else if (info.label) {
          renderer?.triggerBanner(info.label, true);
        }
      },
      onPowerupGain: () => sfx.powerupGain(),
      onLevel: (lv) => music.setIntensity(0.8 + lv * 0.12),
      onGameOver: () => {
        void handleLocalGameOver();
      },
      onWin: (reason) => {
        void handleSoloWin(reason);
      },
    },
    gameMode === 'solo' ? soloKind : null,
  );

  input.attach(engine, (slot) => usePowerup(slot));
  input.setEnabled(false);

  music.setIntensity(gameMode === 'versus' ? 1.4 : 1);
  music.playGame();

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
    pingMs: mode === 'versus' ? pingRtt : null,
    linkOk: mode === 'versus' ? linkOk : undefined,
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
    if (now - lastPingAt > 2000 && room?.connected) {
      lastPingAt = now;
      const n = ++pingSeq;
      lastPingSent = { n, t: now };
      room.send({ t: 'ping', n });
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
    renderer?.triggerBanner(POWERUPS[id].label.toUpperCase(), false);
    return;
  }

  if (mode === 'solo') {
    sfx.powerupSend();
    return;
  }

  // versus debuff -> send to rival (reliable MQTT)
  sfx.powerupSend();
  if (!room?.connected) {
    renderer?.triggerBanner('SIN RIVAL', false);
  }
  const attack =
    id === 'garbage'
      ? {
          t: 'attack' as const,
          id,
          rows: POWERUPS.garbage.garbageRows ?? 2,
          hole: Math.floor(Math.random() * 10),
        }
      : { t: 'attack' as const, id };
  room?.send(attack);
  renderer?.triggerBanner(`→ ${POWERUPS[id].label.toUpperCase()}`, false);

  if (id === 'blind') {
    rivalBlind = true;
    rivalBlindUntil = performance.now() + 4000;
  }
}

async function handleSoloWin(reason: 'sprint' | 'ultra'): Promise<void> {
  if (endingCinematic) return;
  endingCinematic = true;
  gameRunning = false;
  input.setEnabled(false);
  music.duck(0.2, 1200);
  sfx.win();
  renderer?.triggerKo(true);
  const ko = document.getElementById('koOverlay');
  const koText = document.getElementById('koText');
  if (koText) koText.textContent = 'CLEAR';
  ko?.classList.remove('hidden');
  ko?.classList.add('ko-win');
  await wait(1400);
  ko?.classList.add('hidden');
  ko?.classList.remove('ko-win');
  const e = engine;
  if (reason === 'sprint') {
    endMatch(
      '¡Sprint!',
      `${modeLabel('sprint')} en ${formatTime(e?.elapsedMs ?? 0)} · ${e?.score ?? 0} pts`,
    );
  } else {
    endMatch('¡Tiempo!', `Ultra · ${e?.score ?? 0} pts · ${e?.lines ?? 0} líneas`);
  }
}

async function handleLocalGameOver(): Promise<void> {
  if (endingCinematic || engine?.won) return;
  endingCinematic = true;
  gameRunning = false;
  input.setEnabled(false);
  music.duck(0.12, 1600);
  sfx.ko();
  renderer?.triggerKo(false);
  const ko = document.getElementById('koOverlay');
  const koText = document.getElementById('koText');
  if (koText) koText.textContent = mode === 'versus' ? 'KO' : 'OUT';
  ko?.classList.remove('hidden');
  ko?.classList.add('ko-lose');
  await wait(1500);
  ko?.classList.add('hidden');
  ko?.classList.remove('ko-lose');

  if (mode === 'versus') {
    room?.send({ t: 'gameOver', winner: 'rival' });
    endMatch('Derrota', 'Tu torre colapsó.');
  } else if (soloKind === 'survival') {
    endMatch(
      'Survival',
      `Aguantaste ${formatTime(engine?.elapsedMs ?? 0)} · ${engine?.score ?? 0} pts · ${engine?.lines ?? 0} líneas`,
    );
  } else {
    endMatch('Game Over', `Puntos ${engine?.score ?? 0} · Líneas ${engine?.lines ?? 0}`);
  }
}

function endMatch(title: string, sub: string): void {
  gameRunning = false;
  endingCinematic = false;
  iWantRematch = false;
  rivalWantsRematch = false;
  const t = document.getElementById('resultTitle');
  const s = document.getElementById('resultSub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
  goScreen('result');
}

async function cinematicVictory(): Promise<void> {
  if (endingCinematic) return;
  endingCinematic = true;
  gameRunning = false;
  input.setEnabled(false);
  music.duck(0.15, 1600);
  sfx.win();
  renderer?.triggerKo(true);
  const ko = document.getElementById('koOverlay');
  const koText = document.getElementById('koText');
  if (koText) koText.textContent = 'KO';
  ko?.classList.remove('hidden');
  ko?.classList.add('ko-win');
  await wait(1500);
  ko?.classList.add('hidden');
  ko?.classList.remove('ko-win');
  endMatch('¡Victoria!', 'El rival ha caído.');
}

function ensureRoom(): PeerRoom {
  void room?.destroy();
  linkOk = false;
  pingRtt = null;
  resetLobbyReady();
  room = new PeerRoom({
    onStatus: (text) => {
      const el = document.getElementById('roomStatus');
      if (el) el.textContent = text;
    },
    onConnected: (role, code) => {
      linkOk = true;
      document.getElementById('roomCodeDisplay')?.classList.remove('hidden');
      const val = document.getElementById('roomCodeValue');
      if (val) val.textContent = code;
      resetLobbyReady();
      if (role === 'host') {
        versusSeed = (Date.now() ^ (Math.random() * 1e9)) >>> 0;
        room?.send({ t: 'hello', seed: versusSeed, name: 'host' });
      }
      updateLobbyReadyUI();
      const el = document.getElementById('roomStatus');
      if (el) el.textContent = 'Conectado — pulsa Listo cuando quieras';
    },
    onMessage: onNetMessage,
    onDisconnected: () => {
      linkOk = false;
      if (mode === 'versus' && (gameRunning || endingCinematic)) {
        endMatch('Desconectado', 'El rival cerró la conexión.');
      }
      const el = document.getElementById('roomStatus');
      if (el) el.textContent = 'Desconectado';
      resetLobbyReady();
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
      updateLobbyReadyUI();
      break;
    case 'ready':
      rivalReady = true;
      updateLobbyReadyUI();
      tryHostStart();
      break;
    case 'start':
      if (!versusStarted) {
        versusSeed = msg.seed;
        versusStarted = true;
        iWantRematch = false;
        rivalWantsRematch = false;
        void beginVersus(msg.seed);
      }
      break;
    case 'state':
      rivalBoard = msg.board;
      rivalScore = msg.score;
      break;
    case 'attack': {
      if (!engine) return;
      const pid = msg.id as PowerupId;
      if (!(pid in POWERUPS) || POWERUPS[pid].kind !== 'debuff') return;
      sfx.powerupHit();
      music.duck(0.35, 320);
      engine.receiveAttack(pid, { rows: msg.rows, hole: msg.hole });
      renderer?.triggerBanner(POWERUPS[pid].label.toUpperCase(), true);
      break;
    }
    case 'gameOver':
      if (msg.winner === 'rival') {
        void cinematicVictory();
      } else {
        void handleLocalGameOver();
      }
      break;
    case 'rematch':
      rivalWantsRematch = true;
      versusStarted = false;
      const sub = document.getElementById('resultSub');
      if (sub && !iWantRematch) sub.textContent = 'El rival quiere rematch. Pulsa Otra vez.';
      if (iWantRematch) tryStartRematch();
      break;
    case 'ping':
      room?.send({ t: 'pong', n: msg.n });
      break;
    case 'pong':
      if (lastPingSent && msg.n === lastPingSent.n) {
        pingRtt = performance.now() - lastPingSent.t;
      }
      break;
  }
}

async function beginVersus(seed: number): Promise<void> {
  rivalBoard = null;
  rivalScore = 0;
  rivalBlind = false;
  versusStarted = true;
  resetLobbyReady();
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
  endingCinematic = false;
  void room?.destroy();
  room = null;
  linkOk = false;
  mode = 'menu';
  resetLobbyReady();
  goScreen('menu');
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
    case 'open-solo':
      openSoloModes();
      break;
    case 'solo-mode': {
      unlockAudio();
      sfx.ui();
      const m = (t.dataset.mode ?? 'marathon') as SoloKind;
      soloKind = m;
      startEngine('solo', Date.now(), m);
      break;
    }
    case 'versus':
      unlockAudio();
      sfx.ui();
      resetLobbyReady();
      goScreen('versus-setup');
      break;
    case 'open-settings':
      unlockAudio();
      sfx.ui();
      goScreen('settings');
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
    case 'toggle-ready':
      if (!room?.connected || localReady || versusStarted) break;
      localReady = true;
      room.send({ t: 'ready' });
      updateLobbyReadyUI();
      tryHostStart();
      sfx.ui();
      break;
    case 'copy-code': {
      const code = document.getElementById('roomCodeValue')?.textContent ?? '';
      void navigator.clipboard?.writeText(code);
      sfx.ui();
      break;
    }
    case 'toggle-mute': {
      unlockAudio();
      setMute(!muted);
      if (!muted) void music.ensurePlaying();
      break;
    }
    case 'ui-zoom-in':
      bumpUiScale(0.1);
      break;
    case 'ui-zoom-out':
      bumpUiScale(-0.1);
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
        versusStarted = false;
        iWantRematch = true;
        room?.send({ t: 'rematch' });
        const sub = document.getElementById('resultSub');
        if (sub) {
          sub.textContent = rivalWantsRematch
            ? 'Rematch…'
            : 'Esperando al rival…';
        }
        tryStartRematch();
      } else {
        startEngine('solo', Date.now(), soloKind);
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
  menuFx.resize();
});

window.addEventListener('beforeunload', () => {
  unbindKeys();
  void room?.destroy();
});

const settingsForm = document.getElementById('settingsForm');
if (settingsForm) {
  bindSettingsForm(settingsForm, settings, (next) => {
    applySettings(next);
  });
}

applySettings(settings, false);
goScreen('menu');

// First user gesture unlocks audio + starts menu music (browsers block autoplay)
const unlockOnce = () => {
  unlockAudio();
  const screen = document.body.dataset.screen;
  if (
    screen === 'menu' ||
    screen === 'solo-modes' ||
    screen === 'settings' ||
    screen === 'versus-setup'
  ) {
    music.playMenu();
  }
  void music.ensurePlaying();
};
window.addEventListener('pointerdown', unlockOnce, { once: true, capture: true });
window.addEventListener('keydown', unlockOnce, { once: true, capture: true });
