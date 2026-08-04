export type ScreenId = 'menu' | 'versus-setup' | 'game' | 'result';

export function renderAppShell(root: HTMLElement): void {
  root.innerHTML = `
    <div class="atmosphere" aria-hidden="true"></div>
    <div class="scanlines" aria-hidden="true"></div>

    <section id="screen-menu" class="screen screen-menu active">
      <div class="hero">
        <p class="eyebrow">ARCADE REWORK</p>
        <h1 class="brand" data-text="VSTETR.JS">VSTETR.JS</h1>
        <p class="tagline">Caída libre. Basura al rival. Ritmo que no perdona.</p>
        <div class="cta-row">
          <button class="btn btn-primary" data-action="solo">Jugar solo</button>
          <button class="btn btn-secondary" data-action="versus">Versus online</button>
        </div>
        <button class="btn-text" data-action="toggle-mute" id="menuMute">Sonido: ON</button>
      </div>
    </section>

    <section id="screen-versus" class="screen screen-versus">
      <div class="panel-card">
        <button class="btn-back" data-action="back-menu">← Menú</button>
        <h2>Versus online</h2>
        <p class="panel-sub">Crea una sala o únete con el código.</p>
        <div class="versus-actions">
          <button class="btn btn-primary btn-block" data-action="create-room">Crear sala</button>
          <div class="join-row">
            <input id="roomCodeInput" maxlength="6" placeholder="CÓDIGO" autocomplete="off" spellcheck="false" inputmode="text" enterkeyhint="go" />
            <button class="btn btn-secondary" data-action="join-room">Unirse</button>
          </div>
        </div>
        <div class="room-status" id="roomStatus">Listo para conectar</div>
        <div class="room-code-display hidden" id="roomCodeDisplay">
          <span>Tu código</span>
          <strong id="roomCodeValue">----</strong>
          <button class="btn-text" data-action="copy-code">Copiar</button>
        </div>
      </div>
    </section>

    <section id="screen-game" class="screen screen-game">
      <header class="game-top">
        <button class="btn-back" data-action="exit-game">← Salir</button>
        <div class="brand-mini">VSTETR.JS</div>
        <div class="game-top-actions">
          <div class="ui-zoom mobile-only" aria-label="Tamaño de interfaz">
            <button type="button" class="zoom-btn" data-action="ui-zoom-out" aria-label="Más pequeño">−</button>
            <span class="zoom-label" id="uiZoomLabel">100%</span>
            <button type="button" class="zoom-btn" data-action="ui-zoom-in" aria-label="Más grande">+</button>
          </div>
          <button class="btn-text btn-icon" data-action="toggle-mute" id="gameMute" aria-label="Sonido">♪</button>
        </div>
      </header>

      <div class="game-layout" id="gameLayout">
        <aside class="side side-left">
          <div class="stat-block hold-block">
            <label>HOLD</label>
            <canvas id="holdCanvas" width="88" height="88"></canvas>
          </div>
          <div class="stat-block nums">
            <div><span>PTS</span><strong data-score>0</strong></div>
            <div><span>LÍNEAS</span><strong data-lines>0</strong></div>
            <div><span>NIVEL</span><strong data-level>1</strong></div>
          </div>
          <div class="rival-block mobile-rival hidden" id="rivalBlockMobile">
            <label>RIVAL <span data-rival-score-m>0</span></label>
            <canvas id="rivalBoardMobile"></canvas>
          </div>
          <div class="effects" data-effects></div>
        </aside>

        <div class="board-wrap">
          <canvas id="board"></canvas>
          <div id="countdown" class="countdown hidden"></div>
        </div>

        <aside class="side side-right">
          <div class="stat-block next-block">
            <label>NEXT</label>
            <div class="next-stack">
              <canvas data-next></canvas>
              <canvas data-next></canvas>
              <canvas data-next></canvas>
            </div>
          </div>
          <div class="rival-block desktop-rival hidden" id="rivalBlock">
            <label>RIVAL <span data-rival-score>0</span></label>
            <canvas id="rivalBoard"></canvas>
          </div>
          <div class="powerups">
            <label>POWERUPS</label>
            <div class="pu-row">
              <button class="pu-slot" data-slot data-action="use-pu" data-i="0"></button>
              <button class="pu-slot" data-slot data-action="use-pu" data-i="1"></button>
              <button class="pu-slot" data-slot data-action="use-pu" data-i="2"></button>
            </div>
            <p class="hint">Toca un slot · Double+ o cada 4 líneas</p>
          </div>
        </aside>
      </div>

      <div id="touchPad" class="touch-pad" aria-label="Controles táctiles">
        <div class="touch-cluster">
          <button type="button" class="touch-btn touch-rot" data-touch="rotCW" aria-label="Rotar">↻</button>
          <button type="button" class="touch-btn touch-hold" data-touch="hold" aria-label="Hold">H</button>
          <button type="button" class="touch-btn touch-left" data-touch="left" aria-label="Izquierda">←</button>
          <button type="button" class="touch-btn touch-soft" data-touch="soft" aria-label="Bajar">↓</button>
          <button type="button" class="touch-btn touch-right" data-touch="right" aria-label="Derecha">→</button>
          <button type="button" class="touch-btn touch-hard" data-touch="hard" aria-label="Hard drop">⬇</button>
        </div>
      </div>
    </section>

    <section id="screen-result" class="screen screen-result">
      <div class="panel-card result-card">
        <h2 id="resultTitle">Fin</h2>
        <p id="resultSub"></p>
        <div class="cta-row">
          <button class="btn btn-primary btn-block" data-action="again">Otra vez</button>
          <button class="btn btn-secondary btn-block" data-action="back-menu">Menú</button>
        </div>
      </div>
    </section>
  `;
}

export function showScreen(id: ScreenId): void {
  const map: Record<ScreenId, string> = {
    menu: 'screen-menu',
    'versus-setup': 'screen-versus',
    game: 'screen-game',
    result: 'screen-result',
  };
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(map[id])?.classList.add('active');
  document.body.dataset.screen = id;
}
