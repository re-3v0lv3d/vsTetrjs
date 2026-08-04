# VSTETR.JS

Rework arcade de Tetris en **Vite + TypeScript + Canvas**, con versus online P2P (PeerJS / WebRTC), powerups y música procedimental.

Pensado para publicarse en **GitHub Pages** (solo estático; no hace falta servidor propio).

## Jugar

- Local: `npm i && npm run dev`
- Online: activa GitHub Pages (Actions sube el build al hacer push a `main`/`master`)

URL típica: `https://<usuario>.github.io/<repo>/`

## Controles

| Tecla | Acción |
|-------|--------|
| ← → | Mover |
| ↑ / X | Rotar |
| Z | Rotar CCW |
| ↓ | Soft drop |
| Espacio | Hard drop |
| C | Hold |
| 1 2 3 | Usar powerup |
| Esc | Pausa (solo) |

## Versus

1. **Crear sala** → comparte el código de 4 caracteres.
2. El rival elige **Versus online** → pega el código → **Unirse**.
3. Al conectar, countdown y a jugar. Gana quien no haga top-out.

La señalización usa el cloud de PeerJS; la partida va por WebRTC DataChannel. Si un firewall/NAT estricto bloquea WebRTC, la sala puede fallar al unirse.

Opcional: apunta a tu propio PeerServer con variables `VITE_PEER_HOST`, `VITE_PEER_PORT`, `VITE_PEER_PATH`, `VITE_PEER_SECURE`, `VITE_PEER_KEY`.

## Powerups

Se ganan al limpiar **2+ líneas** (o con combo). En versus, los debuffs van al rival; en solo, los debuffs dan bonus de puntos.

- **Basura / Ceguera / Lento / Inverso** — debuffs
- **Turbo / Limpia** — buffs propios

## Stack

- Vite 7 + TypeScript
- Canvas 2D
- PeerJS
- Web Audio (música + SFX sintéticos)

## Scripts

```bash
npm run dev       # desarrollo
npm run build     # dist/ para Pages
npm run preview   # previsualizar build
```

## GitHub Pages

1. Settings → Pages → Source: **GitHub Actions**
2. Push a `main` (workflow `.github/workflows/deploy.yml`)
3. El build usa `VITE_BASE=/<nombre-repo>/` automáticamente

---

Hecho a partir del espíritu de [Tetr.Js](https://github.com/re-3v0lv3d/Tetr.Js).
