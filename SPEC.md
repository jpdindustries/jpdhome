# Website Specification

## Project Overview
Create an immersive, space-themed website with interactive parallax effects and a centered logo, featuring red accent colors matching the brand identity.

## Visual Design

### Color Scheme
- **Background**: Eigengrau (#16161D) or similar dark cosmic color
- **Primary Accent**: Pure red (#FF0000) - matching logo color
- **Secondary Colors**: 
  - Dark reds (#660000, #330000) for subtle gradients
  - Muted cosmic colors (deep purples, blues) for depth
- **Stars**: Varying opacity whites with occasional red-tinted stars

### Background Elements
- **Star Field**:
  - Multiple layers with varying sizes (1-4px)
  - Random distribution with clustering for realism
  - Mix of white and subtle colored stars:
    - 70% white/blue-white stars
    - 20% yellow-white stars
    - 10% red-tinted stars (subtle #FF0000 glow)
  - Occasional twinkling animation
  - Different brightness levels (opacity 0.3-1.0)
  - Special "red giants" - larger red stars with pulsing glow

### Logo & Branding
- **Logo File**: `jpdlogo.svg`
- **Favicon**: `jpdico.png`
- **Position**: Centered viewport
- **Enhancements**:
  - Red glow effect (#FF0000) with subtle pulsing
  - Gentle floating animation
  - Interactive red particle emission on hover
  - Magnetic cursor effect with red trail on desktop

## Interactive Features

### Parallax Motion System

#### Desktop (Cursor-based)
- Multi-layer parallax with different movement speeds:
  - Far stars: 5% movement ratio
  - Mid stars: 10% movement ratio
  - Near stars: 15% movement ratio
  - Logo: 20% movement ratio
  - Red accent particles: 25% movement ratio
- Smooth easing transitions
- Red glow trail following cursor movement
- Boundary constraints to prevent excessive movement

#### Mobile (Sensor-based)
- **Primary**: DeviceOrientation API (gyroscope)
- **Fallback**: Touch-based parallax
- **Settings**:
  - Sensitivity adjustment for comfort
  - Optional motion toggle for accessibility
  - Smooth dampening to prevent jitter
  - Red ripple effects on touch points

## Technical Requirements

### Performance
- GPU acceleration for animations
- Debounced/throttled event handlers
- Lazy rendering for off-screen elements
- Target 60 FPS on modern devices

### Accessibility
- Respect `prefers-reduced-motion`
- Keyboard navigation support
- Proper ARIA labels
- Option to disable motion effects
- Sufficient contrast for red elements

### Browser Support
- Modern browsers (Chrome, Firefox, Safari, Edge)
- Graceful degradation for older browsers
- Progressive enhancement approach

## Creative Enhancements

### Red-Themed Features
1. **Red Nebula Clouds**: Subtle red gradient overlays (#FF0000 to transparent) with slow rotation
2. **Crimson Shooting Stars**: Occasional red-tinted streaks across viewport
3. **Red Giant Stars**: Larger pulsing red stars scattered throughout
4. **Energy Field**: Subtle red particle field around logo
5. **Warp Effect**: Red-shifted stars during parallax movement
6. **Logo Interactions**:
   - Red pulse on load
   - Red particle explosion on click
   - Magnetic red glow following cursor
   - Energy shield effect with red hexagonal pattern

### Additional Visual Effects
1. **Aurora Borealis**: Subtle red aurora waves in background
2. **Constellation Lines**: Connect stars with faint red lines on interaction
3. **Depth Blur**: Gaussian blur on distant layers
4. **Red Alert Mode**: Easter egg - full red theme on special key combination
5. **Comet Trail**: Occasional red comet passing through
6. **Black Hole Effect**: Subtle warping around logo with red event horizon

### Audio (Optional)
- Ambient space sounds on user interaction
- Subtle "energy" sound for red effects
- Volume control and mute option
- No autoplay (user-initiated only)

## Implementation Notes

### File Structure
```
/
├── index.html
├── assets/
│   ├── jpdlogo.svg
│   ├── jpdico.png
│   └── sounds/ (optional)
├── styles/
│   ├── main.css
│   └── animations.css
└── scripts/
    ├── parallax.js
    ├── stars.js
    ├── motion.js
    └── effects.js
```

### HTML Head Requirements
```html
<link rel="icon" type="image/png" href="assets/jpdico.png">
<meta name="theme-color" content="#FF0000">
```

### Key Technologies
- Vanilla JavaScript or lightweight framework
- CSS3 animations and transforms
- Canvas for complex particle effects
- CSS custom properties for red theme variations
- RequestAnimationFrame for smooth animations
- Intersection Observer for performance

### Red Accent Implementation
- CSS Variables for consistent red theming:
  ```css
  --primary-red: #FF0000;
  --red-glow: 0 0 20px rgba(255, 0, 0, 0.5);
  --red-dim: #660000;
  --red-dark: #330000;
  ```
- Red glow effects using box-shadow and filter
- Gradient overlays for depth
- Mix-blend-mode for interesting color interactions

### Testing Checklist
- [ ] Cross-browser compatibility
- [ ] Mobile responsiveness
- [ ] Favicon display across devices
- [ ] Red color accessibility (contrast ratios)
- [ ] Performance metrics (Lighthouse)
- [ ] Accessibility audit
- [ ] Motion sickness considerations
- [ ] Battery usage on mobile
- [ ] Network performance (asset optimization)
- [ ] Color blindness testing for red elements