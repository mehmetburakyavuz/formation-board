import { PITCH_LENGTH, PITCH_WIDTH } from '../core/coords';
import type { Formation } from '../data/formations';

const NS = 'http://www.w3.org/2000/svg';

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  return node;
}

/** Small top-down pitch with the formation's slots (attacking left → right). */
export function miniPitch(f: Formation): SVGSVGElement {
  const L = PITCH_LENGTH;
  const W = PITCH_WIDTH;
  const svg = svgEl('svg', { viewBox: `-3 -3 ${L + 6} ${W + 6}`, class: 'mini-pitch' });
  svg.setAttribute('aria-hidden', 'true');
  const line = { fill: 'none', class: 'mp-line', 'stroke-width': 1.2 };
  svg.append(
    svgEl('rect', { x: 0, y: 0, width: L, height: W, rx: 1.5, class: 'mp-grass' }),
    svgEl('rect', { x: 0, y: 0, width: L, height: W, ...line }),
    svgEl('line', { x1: L / 2, y1: 0, x2: L / 2, y2: W, ...line }),
    svgEl('circle', { cx: L / 2, cy: W / 2, r: 9.15, ...line }),
    svgEl('rect', { x: 0, y: (W - 40.32) / 2, width: 16.5, height: 40.32, ...line }),
    svgEl('rect', { x: L - 16.5, y: (W - 40.32) / 2, width: 16.5, height: 40.32, ...line }),
  );
  for (const s of f.slots) {
    svg.append(
      svgEl('circle', {
        cx: s.nx * L,
        cy: s.ny * W,
        r: 3.4,
        class: s.role === 'GK' ? 'mp-dot mp-gk' : 'mp-dot',
      }),
    );
  }
  return svg;
}
