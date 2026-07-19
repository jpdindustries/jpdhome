# jpd.industries

[![Pages](https://github.com/jpdindustries/jpdhome/actions/workflows/pages.yml/badge.svg)](https://github.com/jpdindustries/jpdhome/actions/workflows/pages.yml)
[![Docker](https://github.com/jpdindustries/jpdhome/actions/workflows/docker.yml/badge.svg)](https://github.com/jpdindustries/jpdhome/actions/workflows/docker.yml)

A space-themed, WebGL-first landing page with a Canvas fallback and no runtime CDN dependencies.

![Demo](assets/demo.gif)

## Display modes

- **Auto** (no `v` query): attempts WebGL2 on every device and falls back to Base only after a hard failure.
- **WebGL** (`?v=webgl`): interactive Three.js starfield, star-count controls, and the logo black-hole easter egg.
- **Base** (`?v=base`): Canvas 2D starfield.
- **Retro** (`?v=retro`): pixel-quantized Canvas presentation.
- **RGB** (`?v=rgb`): RGB Canvas presentation with direction-aware rainbow trails.

Invalid `v` values normalize to Auto. Reduced-motion users receive an ambient scene without parallax, forward flight, flybys, or celestial events.

## Development

Node 24 is pinned in `.nvmrc`.

```bash
npm ci
npm run dev
```

Build and test the production artifact:

```bash
npm run build
npm run test:unit
npx playwright install chromium firefox webkit
npm run test:e2e
```

The Vite build uses a relative base, so the same `dist` directory works at `/` and `/jpdhome/`. Stable runtime diagnostics are published as `data-*` attributes on `<html>` and through `window.__JPD_DIAGNOSTICS__` for browser tests.

## Docker

```bash
docker compose up --build
```

Visit `http://localhost:8080`. The multi-stage image builds the checked-out source with Node 24, then serves only `dist` from nginx.

## Release checks

GitHub Actions builds and tests pull requests, then uploads only `dist` and deploys Pages from `main`. Before a release, also smoke-test physical Safari on iOS 16/current, Android Chrome, and an integrated-GPU laptop; browser emulation does not validate physical mobile GPU behavior.
