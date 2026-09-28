import type { SceneManager } from './SceneManager';

function radius(cs: CSSStyleDeclaration, h: number): number {
  const r = parseFloat(cs.borderTopLeftRadius) || 0;
  return Math.min(r, h / 2);
}

/** Effective opacity of an element (product of its ancestors' up to `root`). */
function opacityOf(el: Element, root: Element): number {
  let o = 1;
  for (let n: Element | null = el; n && n !== root; n = n.parentElement) {
    o *= parseFloat(getComputedStyle(n).opacity) || 1;
  }
  return o;
}

function isShown(el: HTMLElement): boolean {
  for (let n: HTMLElement | null = el; n; n = n.parentElement) {
    const cs = getComputedStyle(n);
    if (cs.display === 'none' || cs.visibility === 'hidden') return false;
  }
  return true;
}

/**
 * Paints the CSS2D label layer onto a canvas: element backgrounds (rounded) and text,
 * using the live DOM layout so the image matches what is on screen.
 */
function paintLabels(ctx: CanvasRenderingContext2D, layer: HTMLElement, scale: number): void {
  const origin = layer.getBoundingClientRect();
  const elements = layer.querySelectorAll<HTMLElement>('*');
  for (const el of elements) {
    if (!isShown(el)) continue;
    const rect = el.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) continue;
    const cs = getComputedStyle(el);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.translate(-origin.left, -origin.top);
    ctx.globalAlpha = opacityOf(el, layer);

    const bg = cs.backgroundColor;
    if (bg && bg !== 'transparent' && !bg.endsWith(', 0)')) {
      ctx.fillStyle = bg;
      ctx.beginPath();
      ctx.roundRect(rect.left, rect.top, rect.width, rect.height, radius(cs, rect.height));
      ctx.fill();
    }

    ctx.fillStyle = cs.color;
    ctx.font = `${cs.fontWeight} ${cs.fontSize} ${cs.fontFamily}`;
    ctx.textBaseline = 'middle';
    for (const node of el.childNodes) {
      if (node.nodeType !== Node.TEXT_NODE || !node.textContent?.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      // One rect per line (notes may wrap).
      const lines = [...range.getClientRects()];
      const words = node.textContent;
      if (lines.length <= 1) {
        const r = lines[0] ?? range.getBoundingClientRect();
        ctx.fillText(words, r.left, r.top + r.height / 2);
      } else {
        // Re-flow the text across the measured line boxes.
        let rest = words.trim();
        for (const r of lines) {
          let cut = rest.length;
          while (cut > 1 && ctx.measureText(rest.slice(0, cut)).width > r.width + 1) {
            const sp = rest.lastIndexOf(' ', cut - 1);
            cut = sp > 0 ? sp : cut - 1;
          }
          ctx.fillText(rest.slice(0, cut), r.left, r.top + r.height / 2);
          rest = rest.slice(cut).trimStart();
        }
      }
    }
    ctx.restore();
  }
}

/** Renders the current view at `scale`× resolution, labels included, as a PNG blob. */
export async function captureScreenshot(sm: SceneManager, scale = 2): Promise<Blob> {
  const { renderer, scene, camera, container, labelRenderer } = sm;
  const w = container.clientWidth;
  const h = container.clientHeight;
  const out = document.createElement('canvas');
  out.width = Math.round(w * scale);
  out.height = Math.round(h * scale);
  const ctx = out.getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');

  const prevRatio = renderer.getPixelRatio();
  try {
    renderer.setPixelRatio(scale);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
    // Copy in the same task as the render (the drawing buffer is not preserved).
    ctx.drawImage(renderer.domElement, 0, 0, out.width, out.height);
  } finally {
    renderer.setPixelRatio(prevRatio);
    renderer.setSize(w, h, false);
    renderer.render(scene, camera);
  }

  labelRenderer.render(scene, camera);
  paintLabels(ctx, labelRenderer.domElement, scale);

  return new Promise((resolve, reject) => {
    out.toBlob((b) => (b ? resolve(b) : reject(new Error('PNG encoding failed'))), 'image/png');
  });
}
