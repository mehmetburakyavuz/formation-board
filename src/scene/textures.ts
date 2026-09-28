import * as THREE from 'three';

function makeCanvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  return [canvas, ctx];
}

/** Deterministic PRNG so the grass looks the same on every load. */
function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Mowing stripes across the pitch length plus subtle noise.
 * `sizeX`/`sizeZ` are the ground dimensions in metres; stripes are aligned to the pitch.
 */
export function createGrassTexture(
  sizeX: number,
  sizeZ: number,
  pitchLength: number,
  stripes: number,
): THREE.CanvasTexture {
  const pxPerM = 16;
  const w = Math.round(sizeX * pxPerM);
  const h = Math.round(sizeZ * pxPerM);
  const [canvas, ctx] = makeCanvas(w, h);
  const stripeW = (pitchLength / stripes) * pxPerM;
  const originX = w / 2 - (pitchLength / 2) * pxPerM;

  const light = '#3b7f38';
  const dark = '#2f6c2d';
  const first = Math.floor(-originX / stripeW) - 1;
  const last = Math.ceil((w - originX) / stripeW) + 1;
  for (let i = first; i < last; i++) {
    ctx.fillStyle = ((i % 2) + 2) % 2 === 0 ? light : dark;
    ctx.fillRect(originX + i * stripeW, 0, stripeW + 1, h);
  }

  // Fine noise: blades and patches.
  const rand = mulberry32(1337);
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const n = (rand() - 0.5) * 14;
    d[i] = Math.max(0, Math.min(255, d[i] + n * 0.6));
    d[i + 1] = Math.max(0, Math.min(255, d[i + 1] + n));
    d[i + 2] = Math.max(0, Math.min(255, d[i + 2] + n * 0.4));
  }
  ctx.putImageData(img, 0, 0);
  ctx.globalAlpha = 0.03;
  for (let i = 0; i < 260; i++) {
    const r = 20 + rand() * 120;
    ctx.fillStyle = rand() > 0.5 ? '#1e4a1b' : '#6fae5c';
    ctx.beginPath();
    ctx.ellipse(
      rand() * w,
      rand() * h,
      r,
      r * (0.4 + rand() * 0.6),
      rand() * Math.PI,
      0,
      Math.PI * 2,
    );
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/** One net mesh cell with transparent background; meant to be repeated. */
export function createNetTexture(): THREE.CanvasTexture {
  const size = 64;
  const [canvas, ctx] = makeCanvas(size, size);
  ctx.clearRect(0, 0, size, size);
  ctx.strokeStyle = 'rgba(255,255,255,0.95)';
  ctx.lineWidth = 5;
  ctx.strokeRect(0, 0, size, size);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
