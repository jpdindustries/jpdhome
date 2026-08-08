export const OBJECT_IDS = Object.freeze(['rocket', 'meteorite', 'astronaut', 'satellite']);

const PROFILES = Object.freeze({
  rocket: { speed: 285, width: 56, tumbleRate: 0, wobble: 0.055, stability: 0.92 },
  meteorite: { speed: 165, width: 54, tumbleRate: 2.7, wobble: 0.02, stability: 0.2 },
  astronaut: { speed: 86, width: 58, tumbleRate: 0.32, wobble: 0.09, stability: 0.3 },
  satellite: { speed: 118, width: 60, tumbleRate: 0.08, wobble: 0.012, stability: 0.98 },
});

export function getObjectProfile(id, theme = 'base') {
  const profile = PROFILES[id] || PROFILES.astronaut;
  return {
    id: PROFILES[id] ? id : 'astronaut',
    ...profile,
    speed: theme === 'rgb' ? profile.speed * 1.18 : profile.speed,
    width: theme === 'rgb' ? Math.round(profile.width * 1.1) : profile.width,
    quantized: theme === 'retro',
    trail: theme === 'rgb' ? 'rainbow' : theme === 'retro' ? 'pixel' : 'neutral',
  };
}
