export function cubicBezierPoint(path, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const inverse = 1 - clamped;
  const a = inverse ** 3;
  const b = 3 * inverse ** 2 * clamped;
  const c = 3 * inverse * clamped ** 2;
  const d = clamped ** 3;
  return {
    x: a * path.start.x + b * path.control1.x + c * path.control2.x + d * path.end.x,
    y: a * path.start.y + b * path.control1.y + c * path.control2.y + d * path.end.y,
  };
}

export function cubicBezierTangent(path, t) {
  const clamped = Math.min(1, Math.max(0, t));
  const inverse = 1 - clamped;
  const x = 3 * inverse ** 2 * (path.control1.x - path.start.x)
    + 6 * inverse * clamped * (path.control2.x - path.control1.x)
    + 3 * clamped ** 2 * (path.end.x - path.control2.x);
  const y = 3 * inverse ** 2 * (path.control1.y - path.start.y)
    + 6 * inverse * clamped * (path.control2.y - path.control1.y)
    + 3 * clamped ** 2 * (path.end.y - path.control2.y);
  const length = Math.hypot(x, y) || 1;
  return { x: x / length, y: y / length, angle: Math.atan2(y, x) };
}

export function approximateBezierLength(path, samples = 32) {
  let length = 0;
  let previous = cubicBezierPoint(path, 0);
  for (let index = 1; index <= samples; index += 1) {
    const point = cubicBezierPoint(path, index / samples);
    length += Math.hypot(point.x - previous.x, point.y - previous.y);
    previous = point;
  }
  return length;
}

function edgeCoordinate(size, rng) {
  const safeInset = size * 0.16;
  return safeInset + rng() * (size - safeInset * 2);
}

function pointOnEdge(edge, width, height, buffer, rng) {
  if (edge === 0) return { x: edgeCoordinate(width, rng), y: -buffer };
  if (edge === 1) return { x: width + buffer, y: edgeCoordinate(height, rng) };
  if (edge === 2) return { x: edgeCoordinate(width, rng), y: height + buffer };
  return { x: -buffer, y: edgeCoordinate(height, rng) };
}

export function isOffscreen(point, width, height) {
  return point.x < 0 || point.x > width || point.y < 0 || point.y > height;
}

export function generateFlybyPath({
  width,
  height,
  buffer = 120,
  rng = Math.random,
} = {}) {
  const viewportWidth = Math.max(1, width || 1);
  const viewportHeight = Math.max(1, height || 1);
  const startEdge = Math.floor(rng() * 4) % 4;
  // Opposite edges guarantee that every scheduled object actually crosses the viewport.
  // The previous adjacent-edge paths could curve entirely around a corner offscreen.
  const endEdge = (startEdge + 2) % 4;
  const start = pointOnEdge(startEdge, viewportWidth, viewportHeight, buffer, rng);
  const end = pointOnEdge(endEdge, viewportWidth, viewportHeight, buffer, rng);
  const dx = end.x - start.x;
  const dy = end.y - start.y;
  const distance = Math.hypot(dx, dy) || 1;
  const normal = { x: -dy / distance, y: dx / distance };
  const bend = Math.min(viewportWidth, viewportHeight)
    * (0.06 + rng() * 0.1)
    * (rng() < 0.5 ? -1 : 1);
  return {
    start,
    control1: {
      x: start.x + dx * 0.3 + normal.x * bend,
      y: start.y + dy * 0.3 + normal.y * bend,
    },
    control2: {
      x: start.x + dx * 0.7 + normal.x * bend,
      y: start.y + dy * 0.7 + normal.y * bend,
    },
    end,
  };
}
