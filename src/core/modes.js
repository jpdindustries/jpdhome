export const MODE_IDS = Object.freeze(['auto', 'webgl', 'base', 'retro', 'rgb']);
export const EXPLICIT_MODE_IDS = Object.freeze(MODE_IDS.slice(1));

export const MODE_LABELS = Object.freeze({
  auto: 'AUTO',
  webgl: 'GL',
  base: '2D',
  retro: 'RETRO',
  rgb: 'RGB',
});

export const MODE_ACCESSIBLE_NAMES = Object.freeze({
  auto: 'Use automatic renderer selection',
  webgl: 'Use WebGL renderer',
  base: 'Use Canvas 2D renderer',
  retro: 'Use Retro Canvas renderer',
  rgb: 'Use RGB Canvas renderer',
});

export function parseRequestedMode(search = '') {
  const params = new URLSearchParams(search);
  const value = params.get('v');
  return EXPLICIT_MODE_IDS.includes(value) ? value : 'auto';
}

export function buildModeUrl(locationLike, mode) {
  const url = new URL(locationLike.href);
  if (EXPLICIT_MODE_IDS.includes(mode)) {
    url.searchParams.set('v', mode);
  } else {
    url.searchParams.delete('v');
  }
  return url.href;
}
