# Website Specification

## Project Overview
This document outlines the specification for an immersive, space-themed website. The project uses JavaScript and HTML5 Canvas to create an interactive parallax starfield with nebula effects, centered around a primary logo. The design incorporates a dark, cosmic color scheme with red accents to align with the brand identity.

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

## Core Features (Implemented)

### Multi-Layered Parallax System
A dynamic parallax effect creates a sense of depth and immersion.
- **Desktop Interaction**: The scene responds to cursor movement, shifting different layers at varying speeds.
- **Automatic Parallax**: A subtle, continuous parallax effect is achieved using a Lissajous curve algorithm, ensuring the scene remains dynamic even without user interaction.
- **Mobile Interaction**: Utilizes the `DeviceOrientation` API (gyroscope) for motion control.

### Dynamic Starfield
The background is a procedurally generated starfield rendered on an HTML5 Canvas.
- **Star Population**: ~1000 stars, with density adjusted for screen size.
- **Star Colors**: A mix of white/blue-white (70%), yellow-white (20%), and red-tinted (10%) stars.
- **Special Stars**:
  - **Red Giants**: Larger, rarer stars with a subtle pulsing red glow.
  - **Twinkling Stars**: Stars feature a gentle twinkling animation.
  - **Shining Stars**: Occasional stars will emit a bright, cross-shaped glint effect.
- **Shooting Stars**: Faint streaks of light periodically traverse the starfield.

### Nebula Clouds
Subtle, generative nebula clouds float in the background to add depth and color to the scene.
- **Generation**: Rendered on a separate canvas layer.
- **Appearance**: Soft, radial gradients with a mix of red and purple hues.
- **Animation**: Clouds slowly drift across the viewport.

### Centered Logo
- **Position**: The logo is fixed in the center of the viewport.
- **Visual Effect**: A pulsing red drop-shadow glow is applied to the logo, enhancing its visibility.
- **Parallax Integration**: The logo moves in response to user input as the topmost layer of the parallax system.

### Floating Space Objects
A variety of space-themed objects traverse the scene, each with unique animations.
- **Objects**: Astronaut, meteorite, rocket, and satellite.
- **Particle Trails**: Objects emit a stream of particles, creating a subtle trail effect.

---

## Technical Implementation

### File Structure
```
/
├── index.html
├── assets/
│   ├── jpdlogo.png
│   ├── jpdico.png
│   ├── jpdaustronaut.png
│   ├── meteorite.png
│   ├── rocket.png
│   └── satellite.png
├── styles/
│   ├── main.css
│   └── animations.css
└── scripts/
    └── main.js
```

### Key Technologies
- **Rendering**: HTML5 Canvas 2D API for the starfield and nebulas.
- **Logic**: Vanilla JavaScript handles all animations, parallax calculations, and event handling.
- **Styling**: CSS3 for layout, logo effects, and animations.
- **Performance**:
  - `requestAnimationFrame` for smooth animation loops.
  - Separate, lower-frequency animation loop for low-priority background elements (nebulas).
- **Accessibility**:
  - Respects `prefers-reduced-motion` to disable animations (though this is not yet fully implemented).

### CSS Theming
CSS Custom Properties are used for consistent theming, especially for the red accent colors.
```css
:root {
  --primary-red: #FF0000;
  --red-glow: 0 0 10px rgba(255, 255, 255, 0.3), 0 0 20px rgba(255, 255, 255, 0.2);
  --background-color: #16161D;
}
```

---

## Known Issues

- **Performance**: The simulation may not consistently achieve 60 FPS on lower-end hardware or large displays due to the high number of stars and particle effects.
- **iOS Device Orientation**: Gyroscope-based parallax requires user permission on iOS, which may not always be granted.
