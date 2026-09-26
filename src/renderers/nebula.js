import * as THREE from 'three';

// Bake the cloud detail once. Animation only moves/scales the sprites, keeping
// the ambient universe inexpensive even on the compact GPU tier.
export function createNebulaTexture(color, seed) {
  const size = 192;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d');
  const pixels = context.createImageData(size, size);
  const channels = color.split(',').map(Number);
  const lattice = new Float32Array(64 * 64);
  let state = (seed + 1) * 7919;
  for (let index = 0; index < lattice.length; index += 1) {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    lattice[index] = state / 0x100000000;
  }
  function noise(x, y) {
    const ix = Math.floor(x);
    const iy = Math.floor(y);
    const fx = x - ix;
    const fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const at = (dx, dy) => lattice[((iy + dy) & 63) * 64 + ((ix + dx) & 63)];
    return THREE.MathUtils.lerp(
      THREE.MathUtils.lerp(at(0, 0), at(1, 0), sx),
      THREE.MathUtils.lerp(at(0, 1), at(1, 1), sx),
      sy,
    );
  }
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const nx = x / size;
      const ny = y / size;
      const warp = noise(nx * 4, ny * 4) * 2;
      const density = noise(nx * 6 + warp, ny * 6 - warp) * 0.58
        + noise(nx * 14 + warp, ny * 14) * 0.28
        + noise(nx * 32, ny * 32) * 0.14;
      const edge = Math.max(0, 1 - Math.hypot(nx - 0.5, ny - 0.5) * 2);
      const filament = Math.max(0, 1 - Math.abs(density - 0.52) * 5);
      const offset = (y * size + x) * 4;
      pixels.data[offset] = channels[0];
      pixels.data[offset + 1] = channels[1];
      pixels.data[offset + 2] = channels[2];
      pixels.data[offset + 3] = 255 * edge ** 1.1 * (density * 0.42 + filament ** 3 * 0.5);
    }
  }
  context.putImageData(pixels, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
