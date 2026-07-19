export const STAR_STEP = 10_000;
export const STAR_MIN = 10_000;
export const STAR_MAX = 2_400_000;

export function clampStarCount(value) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return STAR_MIN;
  return Math.min(STAR_MAX, Math.max(STAR_MIN, Math.round(numeric)));
}

export function changeStarCount(current, direction) {
  const delta = direction < 0 ? -STAR_STEP : STAR_STEP;
  return clampStarCount(Number(current) + delta);
}

export function distributeStarCount(total, weights) {
  const clamped = clampStarCount(total);
  const weightTotal = weights.reduce((sum, weight) => sum + weight, 0);
  let assigned = 0;
  return weights.map((weight, index) => {
    if (index === weights.length - 1) return clamped - assigned;
    const count = Math.max(1, Math.round((clamped * weight) / weightTotal));
    assigned += count;
    return count;
  });
}
