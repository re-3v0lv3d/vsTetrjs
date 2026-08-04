export type ScreenId = 'menu' | 'solo-modes' | 'versus-setup' | 'settings' | 'game' | 'result';

export function renderAppShell(root: HTMLElement): void {
  root.innerHTML = `
    <div class="atmosphere" aria-hidden="true"></div>
    <canvas id="menuFx" class="menu-fx" aria-hidden="true"></canvas>
    <div class="scanlines" aria-hidden="true"></div>

    <section id="screen-menu" class="screen screen-menu active">
      <div class="hero">
        <div class="hero-orbit" aria-hidden="true">
          <span class="orbit-ring"></span>
          <span class="orbit-ring orbit-ring-2"></span>
          <span class="orbit-spark"></span>
        </div>
        <h1 class="brand" data-text="VSTETR.JS">
          <span class="brand-glitch" data-text="VSTETR.JS">VSTETR.JS</span>
        </h1>
        <p class="tagline">Caída libre. Basura al rival. Ritmo que no perdona.</p>
        <div class="cta-row">
          <button type="button" class="btn btn-primary btn-glow" data-action="open-solo">Un jugador</button>
          <button type="button" class="btn btn-secondary btn-glow-soft" data-action="versus">Versus online</button>
        </div>
        <div class="menu-links">
          <button class="btn-text" data-action="open-settings">Ajustes</button>
          <button class="btn-text" data-action="toggle-mute" id="menuMute">Sonido: ON</button>
        </div>
      </div>
    </section>

    <section id="screen-solo" class="screen screen-solo">
      <div class="panel-card modes-card">
        <button class="btn-back" data-action="back-menu">← Menú</button>
        <h2>Un jugador</h2>
        <p class="panel-sub">Elige ritmo: maratón o un modo corto.</p>
        <div class="mode-grid">
          <button class="mode-card" data-action="solo-mode" data-mode="marathon">
            <strong>Normal</strong>
            <span>Sin límite. Sube de nivel y sobrevive.</span>
          </button>
          <button class="mode-card" data-action="solo-mode" data-mode="sprint">
            <strong>Sprint 40</strong>
            <span>40 líneas lo más rápido posible.</span>
          </button>
          <button class="mode-card" data-action="solo-mode" data-mode="ultra">
            <strong>Ultra 2 min</strong>
            <span>Máxima puntuación en dos minutos.</span>
          </button>
          <button class="mode-card" data-action="solo-mode" data-mode="survival">
            <strong>Survival</strong>
            <span>Basura periódica. Aguanta.</span>
          </button>
        </div>
      </div>
    </section>

    <section id="screen-settings" class="screen screen-settings">
      <div class="panel-card settings-card">
        <button class="btn-back" data-action="back-menu">← Menú</button>
        <h2>Ajustes</h2>
        <p class="panel-sub">Toca los parámetros. Se guardan en este dispositivo.</p>
        <form id="settingsForm" class="settings-form" onsubmit="return false">
          <label class="setting-row">
            <span>Música <em data-val="music">85%</em></span>
            <input name="music" type="range" min="0" max="100" step="1" />
          </label>
          <label class="setting-row">
            <span>Efectos <em data-val="sfx">90%</em></span>
            <input name="sfx" type="range" min="0" max="100" step="1" />
          </label>
          <label class="setting-row">
            <span>Zoom UI <em data-val="uiScale">100%</em></span>
            <input name="uiScale" type="range" min="70" max="125" step="5" />
          </label>
          <label class="setting-row">
            <span>Partículas <em data-val="particles">100%</em></span>
            <input name="particles" type="range" min="0" max="100" step="5" />
          </label>
          <label class="setting-row">
            <span>Shake <em data-val="shake">100%</em></span>
            <input name="shake" type="range" min="0" max="100" step="5" />
          </label>
          <label class="setting-row">
            <span>Pulso visual <em data-val="pulse">100%</em></span>
            <input name="pulse" type="range" min="0" max="100" step="5" />
          </label>
          <label class="setting-check">
            <input name="ghost" type="checkbox" />
            <span>Mostrar pieza fantasma</span>
          </label>
          <button type="button" class="btn btn-secondary btn-block" data-action="reset-settings">Restablecer</button>
        </form>
      </div>
    </section>

    <section id="screen-versus" class="screen screen-versus">
      <div class="panel-card">
        <button class="btn-back" data-action="back-menu">← Menú</button>
        <h2>Versus online</h2>
        <p class="panel-sub">Crea una sala o únete con el código. Ambos deben pulsar Listo.</p>
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
        <div class="lobby-ready hidden" id="lobbyReady">
          <div class="ready-row">
            <span id="readyYou">Tú: …</span>
            <span id="readyRival">Rival: …</span>
          </div>
          <button class="btn btn-primary btn-block" data-action="toggle-ready" id="readyBtn">Listo</button>
          <p class="hint" id="lobbyHint">Esperando conexión…</p>
        </div>
      </div>
    </section>

    <section id="screen-game" class="screen screen-game">
      <header class="game-top">
        <button class="btn-back" data-action="exit-game">← Salir</button>
        <div class="brand-mini">VSTETR.JS</div>
        <div class="game-top-actions">
          <div class="net-badge hidden" id="netBadge" title="Latencia">
            <span class="net-dot" id="netDot"></span>
            <span id="netPing">—</span>
          </div>
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
            <div class="mode-stat hidden" id="modeStatRow"><span data-mode-label>MODO</span><strong data-mode-stat>—</strong></div>
          </div>
          <div class="combo-meter" id="comboMeter" aria-live="polite">
            <span class="combo-label">COMBO</span>
            <strong class="combo-value" data-combo>0</strong>
            <span class="combo-mul" data-combo-mul>×1.0</span>
          </div>
          <div class="effects" data-effects></div>
        </aside>

        <div class="board-wrap">
          <canvas id="board"></canvas>
          <div id="countdown" class="countdown hidden"></div>
          <div id="koOverlay" class="ko-overlay hidden" aria-hidden="true">
            <span class="ko-text" id="koText">KO</span>
          </div>
          <div id="comboBurst" class="combo-burst hidden" aria-hidden="true"></div>
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
          <div class="rival-block mobile-rival hidden" id="rivalBlockMobile">
            <label>RIVAL <span data-rival-score-m>0</span></label>
            <canvas id="rivalBoardMobile"></canvas>
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
    'solo-modes': 'screen-solo',
    'versus-setup': 'screen-versus',
    settings: 'screen-settings',
    game: 'screen-game',
    result: 'screen-result',
  };
  document.querySelectorAll('.screen').forEach((el) => el.classList.remove('active'));
  document.getElementById(map[id])?.classList.add('active');
  document.body.dataset.screen = id;
}
