# Website Specification

## Project Overview
This document outlines the specification for an immersive, space-themed website. The project uses JavaScript and HTML5 Canvas to create an interactive parallax starfield with nebula effects, centered around a primary logo. The design incorporates a dark, cosmic color scheme with red accents to align with the brand identity.

The project is currently in active development. Features are divided into what is currently implemented and what is planned for future enhancements.

## Visual Design

### Color Scheme
- **Background**: Eigengrau (`#16161D`)
- **Primary Accent**: Pure red (`#FF0000`)
- **Secondary Colors**: Dark reds, deep purples, and blues for gradients and depth.
- **Stars**: A mix of white, blue-white, yellow-white, and red-tinted stars.

### Branding
- **Logo File**: `assets/jpdlogo.svg`
- **Favicon**: `assets/jpdico.png`

---

## Core Features (Implemented)

### Multi-Layered Parallax System
A dynamic parallax effect creates a sense of depth and immersion.
- **Desktop Interaction**: The scene responds to cursor movement, shifting different layers at varying speeds.
- **Mobile Interaction**: Utilizes the `DeviceOrientation` API (gyroscope) for motion control, with a fallback for devices without gyroscopes.
- **Layer Speeds**:
  - Far Stars: Slowest movement
  - Mid Stars: Medium movement
  - Near Stars: Faster movement
  - Logo: Most responsive movement

### Dynamic Starfield
The background is a procedurally generated starfield rendered on an HTML5 Canvas.
- **Star Population**: ~1000 stars with varying sizes (1-4px) and opacity (0.3-1.0).
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
- **Animation**: Clouds slowly drift and rotate across the viewport.

### Centered Logo
- **Position**: The logo is fixed in the center of the viewport.
- **Visual Effect**: A pulsing red drop-shadow glow is applied to the logo, enhancing its visibility.
- **Parallax Integration**: The logo moves in response to user input as the topmost layer of the parallax system.

---

## Future Enhancements (Planned)

### Advanced Interactivity
- **Magnetic Cursor**: A desktop-only feature where the cursor emits a red light trail and has a magnetic pull on nearby particles.
- **Logo Interaction**:
  - **Particle Emission**: Emit a burst of red particles on hover or click.
  - **Energy Shield**: A hexagonal energy shield effect that appears around the logo on interaction.
- **Red Alert Mode**: An Easter egg that turns the entire theme red when a specific key combination is pressed.

### Additional Visual Effects
- **Aurora Borealis**: Subtle, waving red aurora effects in the background.
- **Constellation Lines**: Faint red lines connecting stars that appear on user interaction.
- **Black Hole Effect**: A subtle gravitational warping effect around the logo.
- **Comet Trails**: Larger, more dramatic comets that occasionally pass through the scene.

### Audio
- **Ambient Sound**: Optional, user-initiated ambient space sounds.
- **Interaction Sounds**: Subtle audio feedback for interactions with the logo and other elements.

---

## Technical Implementation

### File Structure
```
/
├── index.html
├── assets/
│   ├── jpdlogo.svg
│   └── jpdico.png
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
  - Event handlers are optimized for performance.
- **Accessibility**:
  - Respects `prefers-reduced-motion` to disable animations.
  - Clean and semantic HTML structure.

### CSS Theming
CSS Custom Properties are used for consistent theming, especially for the red accent colors.
```css
:root {
  --primary-red: #FF0000;
  --red-glow: 0 0 10px rgba(255, 255, 255, 0.3), 0 0 20px rgba(255, 255, 255, 0.2);
  --background-color: #16161D;
}
```

### Testing Checklist
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness and orientation
- [ ] Performance metrics (60 FPS target)
- [ ] Accessibility audit (contrast, keyboard nav)
- [ ] Motion sickness considerations
- [ ] Asset optimization
