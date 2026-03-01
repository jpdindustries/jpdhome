# jpd.industries

[![Docker](https://github.com/jpdindustries/jpdhome/actions/workflows/docker.yml/badge.svg)](https://github.com/jpdindustries/jpdhome/actions/workflows/docker.yml)

A space-themed website with interactive parallax effects and automatic capability-based version selection.

![Demo](assets/demo.gif)

## Versions

The site detects your device capabilities and automatically selects the optimal version:
- **Base**: Canvas 2D implementation optimized for all devices
- **WebGL**: High-performance Three.js implementation
- **Retro & RGB**: Hidden retro-styled versions

You can manually force a version via the URL parameter (e.g., `?v=webgl` or `?v=rgb`).

## Development

**Run locally:**
```bash
python3 -m http.server 8000
```
Then visit `http://localhost:8000`.

**Run with Docker:**
```bash
docker-compose up --build
```
Then visit `http://localhost:8080`.
