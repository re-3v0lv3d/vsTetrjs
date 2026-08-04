# VSTETR.JS

Rework arcade de Tetris en **Vite + TypeScript + Canvas**, con versus online por código de sala, powerups y música procedimental.

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

El versus usa un **relay MQTT público por WebSocket** (no WebRTC), así que funciona entre redes distintas / 4G / fibra sin TURN. Opcional: `VITE_MQTT_URL` para tu propio broker.

## Powerups

Se ganan al limpiar **2+ líneas** (o con combo). En versus, los debuffs van al rival; en solo, los debuffs dan bonus de puntos.

- **Basura / Ceguera / Lento / Inverso** — debuffs
- **Turbo / Limpia** — buffs propios

## Stack

- Vite 7 + TypeScript
- Canvas 2D
- MQTT.js (versus online)
- Web Audio (música + SFX sintéticos)

## Scripts

```bash
npm run dev       # desarrollo
npm run build     # dist/ para Pages
npm run preview   # previsualizar build
```

## GitHub Pages

1. Push a `main` (el workflow construye Vite y publica la rama `gh-pages`)
2. Settings → Pages → Source: **Deploy from a branch**
3. Branch: **`gh-pages`** / folder: **`/ (root)`** → Save
4. URL: `https://<usuario>.github.io/<repo>/`

> Importante: no elijas la rama `main` como source (serviría el `index.html` de desarrollo y verías pantalla en blanco).

---

Hecho a partir del espíritu de [Tetr.Js](https://github.com/re-3v0lv3d/Tetr.Js).
