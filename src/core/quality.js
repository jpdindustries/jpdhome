const TIERS = Object.freeze({
  compact: {
    name: 'compact',
    dprLimit: 1.35,
    antialias: false,
    flightSpeed: 185,
    nebulaCount: 4,
    starCounts: [7_800, 13_200, 6_800],
  },
  mid: {
    name: 'mid',
    dprLimit: 1.7,
    antialias: true,
    flightSpeed: 260,
    nebulaCount: 5,
    starCounts: [12_800, 21_800, 10_500],
  },
  desktop: {
    name: 'desktop',
    dprLimit: 2,
    antialias: true,
    flightSpeed: 330,
    nebulaCount: 6,
    starCounts: [18_000, 31_000, 15_000],
  },
});

export function getQualityTier({
  width,
  devicePixelRatio = 1,
  coarsePointer = false,
} = {}) {
  const viewportWidth = Number(width) || 1280;
  const key = viewportWidth < 820 || coarsePointer
    ? 'compact'
    : viewportWidth < 1280
      ? 'mid'
      : 'desktop';
  const tier = TIERS[key];
  return {
    ...tier,
    starCounts: [...tier.starCounts],
    pixelRatio: Math.min(Math.max(Number(devicePixelRatio) || 1, 1), tier.dprLimit),
  };
}

export function createMotionConfig(reducedMotion = false) {
  return reducedMotion
    ? {
        reducedMotion: true,
        pointerParallax: false,
        automaticFlight: false,
        flybys: false,
        celestialEvents: false,
        gentleTwinkle: true,
        blackHoleGrowthDuration: 0,
      }
    : {
        reducedMotion: false,
        pointerParallax: true,
        automaticFlight: true,
        flybys: true,
        celestialEvents: true,
        gentleTwinkle: true,
        blackHoleGrowthDuration: 10_000,
      };
}

export function getRuntimePreferences(windowLike = window) {
  const reducedMotion = windowLike.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const coarsePointer = windowLike.matchMedia('(pointer: coarse)').matches;
  return {
    quality: getQualityTier({
      width: windowLike.innerWidth,
      devicePixelRatio: windowLike.devicePixelRatio,
      coarsePointer,
    }),
    motion: createMotionConfig(reducedMotion),
    coarsePointer,
  };
}
