# Website Specification (v2 - WebGL)

## Project Overview
This document outlines the specification for an immersive, space-themed website, refactored to use **WebGL** for high-performance rendering. The project leverages the **Three.js** library to create a GPU-accelerated interactive parallax starfield with nebula effects, centered around a primary logo. The goal of this refactor was to solve performance bottlenecks on high-resolution displays while maintaining and enhancing the original visual experience.

## Visual Design

### Color Scheme
- **Background**: Eigengrau (`#16161D`)
- **Primary Accent**: Pure red (`#FF0000`)
- **Secondary Colors**: Dark reds, deep purples, and blues for gradients and depth.
- **Stars**: A mix of white, blue-white, yellow-white, and red-tinted stars.

### Branding
- **Logo File**: `assets/jpdlogo.png`
- **Favicon**: `assets/jpdico.png`

---

## Core Features

### Multi-Layered Parallax System
A dynamic parallax effect creates a sense of depth and immersion.
- **Technology**: Implemented by moving multiple `THREE.Points` layers at different speeds.
- **Desktop Interaction**: The scene responds to cursor movement, shifting the star layers to create a parallax effect.
- **Automatic Parallax (TODO)**: A subtle, continuous parallax effect using a Lissajous curve algorithm needs to be re-implemented to keep the scene dynamic.

### Dynamic Starfield
The background is a procedurally generated starfield rendered by WebGL.
- **Star Population**: ~20,000 stars, distributed across two layers for depth.
- **Star Colors**: A mix of white/blue-white, yellow-white, and red-tinted stars.
- **Special Stars**:
  - **Twinkling Stars (TODO)**: The gentle twinkling animation needs to be perfected.
  - **Shining Stars**: Occasional stars emit a bright, cross-shaped glint effect, implemented in a custom shader.

### Generative Nebula Clouds
Subtle, generative nebula clouds float in the background.
- **Technology**: Rendered using a custom GLSL shader on large `THREE.PlaneGeometry`.
- **Appearance**: Soft, procedural noise generates cloud-like structures with red and purple hues.
- **Animation (TODO)**: The drifting animation needs refinement to feel smoother and more natural. The edges of the planes are sometimes visible and must be hidden.

### Centered Logo
- **Position**: The logo is a DOM element fixed in the center of the viewport.
- **Visual Effect**: A pulsing red drop-shadow glow is applied via CSS.
- **Parallax Integration**: The logo moves in response to user input.
- **Recentering (TODO)**: The logic to re-center the logo after a period of mouse inactivity or when the cursor leaves the window needs to be re-implemented.

### Minimal Celestial Events
Sparse natural events traverse the scene without large foreground sprites.
- **Events**: Small meteors and micro-comets rendered on a lightweight 2D overlay canvas.
- **Trails**: Dim, realistic stellar-adjacent colors with short fading tails.

### Black Hole Easter Egg
- **Trigger**: Click or tap the centered JPD logo 3 times within 3 seconds.
- **Logo Behavior**: The logo locks to the exact center once triggered and is kept fully inside the active lens core, with warped stars visible through the transparent logo area.
- **Growth**: The black-hole lens appears immediately at the logo-fitting core size, then its outer distortion/disc system grows to 55% of the smaller viewport dimension after 10 seconds.
- **Rendering**: The existing WebGL scene is rendered into an offscreen space texture, a separate full-resolution distortion texture is rendered, and both are composited in a final shader pass.
- **Visuals**: The shader adds a dark lens core, sparse warped stars, a smooth photon rim, RGB-shifted edge lensing, and a soft gathered-light cloud inspired by Bruno Simon's WebGL black-hole rendering approach.
- **Duration**: The effect remains active after reaching full size until the page reloads.

---

## Technical Implementation

### File Structure
```
/
├── index.html
├── assets/
│   ├── ... (image assets) ...
├── styles/
│   ├── main.css
│   └── animations.css
└── scripts/
    └── scene.js  <-- Formerly main.js
```

### Key Technologies
- **Rendering**: **WebGL** via the **Three.js** library.
- **Logic**: Vanilla JavaScript (ES6 Modules) handles all animations, parallax, and event handling.
- **Shaders**: Custom **GLSL** shaders are used for the nebula and star effects.
- **Styling**: CSS3 for layout, logo effects, and DOM animations.
- **Performance**:
  - All heavy rendering is offloaded to the GPU.
  - `requestAnimationFrame` for smooth animation loops.

### CSS Theming
CSS Custom Properties are used for consistent theming.
```css
:root {
  --primary-red: #FF0000;
  --red-glow: 0 0 15px rgba(255, 100, 100, 0.7), 0 0 25px rgba(255, 0, 0, 0.5);
  --background-color: #16161D;
}
```

---

## Known Issues
- The new features from the TODO list need to be implemented.
