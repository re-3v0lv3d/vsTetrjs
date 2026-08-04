export type MusicBed = 'menu' | 'game' | 'none';

const FADE_IN_S = 1.6;
const FADE_OUT_S = 2.2;

function asset(path: string): string {
  const base = import.meta.env.BASE_URL || './';
  return `${base}${path.replace(/^\//, '')}`;
}

const TRACKS = {
  menu: asset('audio/menu.mp3'),
  game: [asset('audio/game1.mp3'), asset('audio/game2.mp3'), asset('audio/game3.mp3')],
} as const;

/** Streamed MP3 beds with fade in/out at track edges */
export class MusicSynth {
  muted = false;
  volume = 0.85;
  intensity = 1;

  private bed: MusicBed = 'none';
  private audio: HTMLAudioElement | null = null;
  private gameIndex = 0;
  private unlocked = false;
  private fadeToken = 0;
  private ending = false;
  private advancing = false;
  private watchTimer: number | null = null;

  unlock(): void {
    this.unlocked = true;
  }

  /** @deprecated use playMenu / playGame */
  start(): void {
    this.unlock();
    if (this.bed === 'none') void this.playMenu();
  }

  playMenu(): void {
    this.unlocked = true;
    void this.switchBed('menu');
  }

  playGame(): void {
    this.unlocked = true;
    if (this.bed !== 'game') {
      this.gameIndex = Math.floor(Math.random() * TRACKS.game.length);
    }
    void this.switchBed('game');
  }

  stop(): void {
    void this.switchBed('none');
  }

  /** Resume after autoplay block or unmute */
  async ensurePlaying(): Promise<void> {
    if (!this.unlocked || this.bed === 'none') return;
    if (this.audio) {
      if (this.audio.paused) {
        try {
          await this.audio.play();
        } catch {
          return;
        }
      }
      if (!this.ending) await this.fadeTo(this.targetVolume(), FADE_IN_S * 0.6);
      return;
    }
    await this.startCurrentTrack(true);
  }

  setIntensity(level: number): void {
    this.intensity = Math.max(0.7, Math.min(2, level));
    this.applyTargetVolume(0.2);
  }

  setVolume(v: number): void {
    this.volume = Math.max(0, Math.min(1, v));
    this.applyTargetVolume(0.08);
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (!m) void this.ensurePlaying();
    else this.applyTargetVolume(0.05);
  }

  getBpm(): number {
    return 112 + (this.intensity - 1) * 6;
  }

  private targetVolume(): number {
    if (this.muted || this.bed === 'none') return 0;
    // Keep headroom; intensity nudges game bed a bit
    const base = this.bed === 'game' ? 0.55 + this.intensity * 0.06 : 0.52;
    return Math.min(1, base * this.volume);
  }

  private applyTargetVolume(smoothS: number): void {
    if (!this.audio || this.ending) return;
    void this.fadeTo(this.targetVolume(), smoothS);
  }

  private async switchBed(next: MusicBed): Promise<void> {
    if (next === this.bed && this.audio && !this.audio.paused) return;
    this.bed = next;
    await this.tearDown(true);
    if (next === 'none' || !this.unlocked) return;
    await this.startCurrentTrack(true);
  }

  private currentUrl(): string | null {
    if (this.bed === 'menu') return TRACKS.menu;
    if (this.bed === 'game') return TRACKS.game[this.gameIndex % TRACKS.game.length]!;
    return null;
  }

  private async startCurrentTrack(fadeIn: boolean): Promise<void> {
    const url = this.currentUrl();
    if (!url) return;

    const a = new Audio(url);
    a.preload = 'auto';
    a.loop = false;
    a.volume = 0;
    this.audio = a;
    this.ending = false;

    a.addEventListener('ended', () => {
      void this.onTrackEnded();
    });

    try {
      await a.play();
    } catch {
      // Autoplay blocked until next gesture
      return;
    }

    if (fadeIn) await this.fadeTo(this.targetVolume(), FADE_IN_S);
    else a.volume = this.targetVolume();

    this.armEndWatcher(a);
  }

  private armEndWatcher(a: HTMLAudioElement): void {
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    this.watchTimer = window.setInterval(() => {
      if (this.audio !== a || this.ending) return;
      if (!Number.isFinite(a.duration) || a.duration <= 0) return;
      const left = a.duration - a.currentTime;
      if (left <= FADE_OUT_S + 0.05) {
        this.ending = true;
        void this.fadeTo(0, Math.max(0.25, left)).then(() => {
          if (this.audio === a) void this.onTrackEnded();
        });
      }
    }, 120);
  }

  private async onTrackEnded(): Promise<void> {
    if (this.bed === 'none' || this.advancing) return;
    this.advancing = true;
    try {
      await this.tearDown(false);
      if (this.bed === 'game') {
        this.gameIndex = (this.gameIndex + 1) % TRACKS.game.length;
      }
      if (this.bed === 'menu' || this.bed === 'game') {
        await this.startCurrentTrack(true);
      }
    } finally {
      this.advancing = false;
    }
  }

  private async tearDown(fadeOut: boolean): Promise<void> {
    if (this.watchTimer !== null) {
      clearInterval(this.watchTimer);
      this.watchTimer = null;
    }
    const a = this.audio;
    this.audio = null;
    if (!a) return;
    if (fadeOut && a.volume > 0.01 && !a.paused) {
      this.audio = a; // fadeTo uses this.audio
      await this.fadeTo(0, Math.min(FADE_OUT_S, 1.1));
      this.audio = null;
    }
    a.pause();
    a.removeAttribute('src');
    a.load();
  }

  private fadeTo(target: number, seconds: number): Promise<void> {
    const a = this.audio;
    if (!a) return Promise.resolve();
    const token = ++this.fadeToken;
    const from = a.volume;
    const dur = Math.max(0.05, seconds) * 1000;
    const t0 = performance.now();

    return new Promise((resolve) => {
      const step = (now: number) => {
        if (token !== this.fadeToken || this.audio !== a) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - t0) / dur);
        // smoothstep
        const e = t * t * (3 - 2 * t);
        a.volume = Math.max(0, Math.min(1, from + (target - from) * e));
        if (t < 1) requestAnimationFrame(step);
        else {
          a.volume = Math.max(0, Math.min(1, target));
          resolve();
        }
      };
      requestAnimationFrame(step);
    });
  }
}
