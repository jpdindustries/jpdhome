const MAX_TILT_DEGREES = 18;
const SAMPLE_LIFETIME_MS = 1500;

function angleDelta(value, origin) {
  return ((value - origin + 540) % 360) - 180;
}

export function projectDeviceTilt({ beta, gamma, originBeta, originGamma, angle = 0, width, height }) {
  const radians = angle * Math.PI / 180;
  const horizontal = angleDelta(gamma, originGamma);
  const vertical = angleDelta(beta, originBeta);
  const x = horizontal * Math.cos(radians) - vertical * Math.sin(radians);
  const y = horizontal * Math.sin(radians) + vertical * Math.cos(radians);
  return {
    x: Math.max(-1, Math.min(1, x / MAX_TILT_DEGREES)) * Math.min(width * 0.45, 240),
    y: Math.max(-1, Math.min(1, y / MAX_TILT_DEGREES)) * Math.min(height * 0.35, 220),
  };
}

export function createDeviceTilt({ windowLike = window, documentLike = document, coarsePointer, reducedMotion }) {
  const orientationType = windowLike.DeviceOrientationEvent;
  const supported = Boolean(coarsePointer && !reducedMotion && windowLike.isSecureContext && orientationType);
  const requiresPermission = supported && typeof orientationType.requestPermission === 'function';
  let enabled = false;
  let disposed = false;
  let origin = null;
  let angle = 0;
  let x = 0;
  let y = 0;
  let lastSampleAt = 0;

  function screenAngle() {
    return Number(windowLike.screen?.orientation?.angle ?? windowLike.orientation ?? 0) || 0;
  }

  function reset() {
    origin = null;
    x = 0;
    y = 0;
    lastSampleAt = 0;
  }

  function onOrientation(event) {
    if (documentLike.hidden || !Number.isFinite(event.beta) || !Number.isFinite(event.gamma)) return;
    const currentAngle = screenAngle();
    if (!origin || currentAngle !== angle) {
      angle = currentAngle;
      origin = { beta: event.beta, gamma: event.gamma };
    }
    ({ x, y } = projectDeviceTilt({
      beta: event.beta,
      gamma: event.gamma,
      originBeta: origin.beta,
      originGamma: origin.gamma,
      angle,
      width: windowLike.innerWidth,
      height: windowLike.innerHeight,
    }));
    lastSampleAt = performance.now();
  }

  function onVisibilityChange() {
    reset();
  }

  function start() {
    if (disposed || enabled || !supported) return false;
    enabled = true;
    reset();
    windowLike.addEventListener('deviceorientation', onOrientation);
    documentLike.addEventListener('visibilitychange', onVisibilityChange);
    return true;
  }

  if (supported && !requiresPermission) start();

  return {
    supported,
    get enabled() { return enabled; },
    async enable() {
      if (enabled) return true;
      if (!supported || disposed) return false;
      if (requiresPermission) {
        try {
          if (await orientationType.requestPermission() !== 'granted') return false;
        } catch {
          return false;
        }
      }
      return start();
    },
    disable() {
      if (!enabled) return;
      enabled = false;
      windowLike.removeEventListener('deviceorientation', onOrientation);
      documentLike.removeEventListener('visibilitychange', onVisibilityChange);
      reset();
    },
    getInput() {
      return {
        x,
        y,
        active: enabled && lastSampleAt > 0 && performance.now() - lastSampleAt < SAMPLE_LIFETIME_MS,
      };
    },
    dispose() {
      disposed = true;
      this.disable();
    },
  };
}
