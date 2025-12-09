# jpd.industries

[![Docker](https://github.com/jpdindustries/jpdhome/actions/workflows/docker.yml/badge.svg)](https://github.com/jpdindustries/jpdhome/actions/workflows/docker.yml)

A space-themed website with interactive parallax effects and automatic version selection.

![Demo GIF](assets/demo.gif)

## Overview

This is the combined homepage for jpd.industries that automatically selects between two versions based on device capabilities:

- **Base Version**: Canvas 2D implementation with ~1000 stars, optimized for all devices
- **WebGL Version**: GPU-accelerated Three.js implementation with ~100,000 stars, for high-performance devices

The website features a multi-layered parallax system with procedurally generated stars, nebulas, and floating space objects.

## Features

### Automatic Version Selection
- **WebGL Support Check**: Detects WebGL capability
- **Performance Test**: Runs a 2-second benchmark to ensure smooth 30+ FPS performance
- **Graceful Fallback**: Automatically falls back to base version if WebGL fails or performs poorly

### Parallax System
- **Desktop**: Mouse movement creates a parallax effect
- **Mobile**: Uses the device gyroscope for motion control
- **Depth Effect**: Layers move at different speeds to create a sense of depth

### Starfield
- **Base Version**: ~1000 procedurally generated stars
- **WebGL Version**: ~100,000 stars across multiple depth layers
- Effects include pulsing red giants, twinkling stars, shining stars, and shooting stars

### Visuals
- Drifting red and purple nebula clouds
- Floating objects: astronaut, meteorite, rocket, and satellite
- The centered logo has a pulsing red glow that reacts to user input

## Technical Implementation

### File Structure
```
/ 
├── index.html                 # Main entry point with detection
├── CNAME                      # GitHub Pages domain
├── README.md                  # This file
├── Dockerfile                 # Docker image for webserver
├── docker-compose.yml         # Docker Compose for easy running
├── base/                      # Canvas 2D version
├── webgl/                     # WebGL version
├── shared/                    # Common assets
│   └── styles/
│       ├── animations.css    # Shared animations
│       └── loading.css       # Loading screen styles
└── scripts/
    └── detector.js           # Capability detection & loading
```

### Key Technologies
- **Base Version**: HTML5 Canvas 2D API, vanilla JavaScript
- **WebGL Version**: Three.js library, WebGL, custom GLSL shaders
- **Detection**: WebGL context testing, performance benchmarking
- **Styling**: CSS3 with custom properties for theming

### Performance Requirements
- **WebGL Version**: Requires WebGL support + 30+ FPS in benchmark
- **Base Version**: Works on all modern browsers with Canvas support
- **Mobile**: Responsive design with gyroscope support where available

## Development

### Running Locally
```bash
# Start a local server (required for WebGL)
python3 -m http.server 8000
# or
npx serve .
```

### Running with Docker
```bash
# Build and run with Docker Compose
docker-compose up --build

# Or build and run manually
docker build -t jpd-industries .
docker run -p 8080:80 jpd-industries
```

The site will be available at http://localhost:8080

### Testing Version Selection
Open browser developer tools and check the console for detection results:
```
Starting capability detection...
WebGL Renderer: [renderer info]
Performance test: [X.X] FPS
Performance test passed/failed, using [version]
```

You can also access `window.versionDetector.getResults()` for detailed test information.

### Manual Version Override
To force a specific version, modify the URL:
- `?version=base` - Force base version
- `?version=webgl` - Force WebGL version (may fail if unsupported)
