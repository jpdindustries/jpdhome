export const THEMES = Object.freeze({
  base: {
    id: 'base',
    starCount: 1_337,
    starShape: 'circle',
    background: '#16161d',
    nebula: ['255, 24, 86', '110, 62, 210'],
    starColors: ['200, 210, 255', '255, 245, 205', '255, 182, 182'],
  },
  retro: {
    id: 'retro',
    starCount: 1_337,
    starShape: 'pixel',
    background: '#0d0d14',
    nebula: ['210, 24, 70', '86, 40, 150'],
    starColors: ['200, 210, 255', '255, 245, 205', '255, 182, 182'],
  },
  rgb: {
    id: 'rgb',
    starCount: 1_337,
    starShape: 'pixel',
    background: '#05040f',
    nebula: ['255, 44, 236', '0, 255, 240', '84, 82, 255'],
    starColors: ['255, 44, 236', '0, 235, 255', '255, 245, 0', '40, 255, 84'],
  },
});

export function getTheme(id) {
  return THEMES[id] || THEMES.base;
}
