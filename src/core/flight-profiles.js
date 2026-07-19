export const OBJECT_IDS = Object.freeze(['rocket', 'meteorite', 'astronaut', 'satellite']);

const PROFILES = Object.freeze({
  rocket: { speed: 270, width: 44, tumbleRate: 0, wobble: 0.055, stability: 0.92 },
  meteorite: { speed: 150, width: 42, tumbleRate: 2.7, wobble: 0.02, stability: 0.2 },
  astronaut: { speed: 72, width: 46, tumbleRate: 0.32, wobble: 0.09, stability: 0.3 },
  satellite: { speed: 105, width: 48, tumbleRate: 0.08, wobble: 0.012, stability: 0.98 },
});

export function getObjectProfile(id, theme = 'base') {
  const profile = PROFILES[id] || PROFILES.astronaut;
  return {
    id: PROFILES[id] ? id : 'astronaut',
    ...profile,
    quantized: theme === 'retro',
    trail: theme === 'rgb' ? 'rainbow' : theme === 'retro' ? 'pixel' : 'neutral',
  };
}
