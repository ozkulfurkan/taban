// SoleCost marka işareti (bordo-beyaz). Tek kaynak: uygulama simgeleri, favicon ve web logosu buradan üretilir.
// Çalıştırma: node scripts/brand/render.js  (Playwright + Chromium ile PNG'ler üretilir)
const BORDO = '#6B1A2C';
const WHITE = '#FFFFFF';

// Taban silüeti (256 birimlik tuval)
const SOLE = 'M60 92 Q82 76 112 76 L182 76 Q204 76 214 94 L226 138 Q228 162 214 174 L192 190 Q180 196 160 196 L92 196 Q68 196 52 184 L36 168 Q30 150 36 132 Z';

/**
 * @param {{ bg?: string|null, sole?: string, text?: string, cutout?: boolean, scale?: number }} o
 *  bg: zemin rengi (null = şeffaf); cutout: yazı silüetten oyulur (tek renk simge için)
 */
function markSvg({ bg = BORDO, sole = WHITE, text = BORDO, cutout = false, scale = 1 } = {}) {
  const t = (256 - 256 * scale) / 2;
  const letters = `<text x="131" y="138" font-family="Inter, 'Helvetica Neue', Arial, sans-serif" font-size="74" font-weight="800" letter-spacing="2" text-anchor="middle" dominant-baseline="central">SC</text>`;
  const body = cutout
    ? `<mask id="m"><rect width="256" height="256" fill="#fff"/><g fill="#000">${letters}</g></mask><path d="${SOLE}" fill="${sole}" mask="url(#m)"/>`
    : `<path d="${SOLE}" fill="${sole}"/><g fill="${text}">${letters}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" width="256" height="256">${bg ? `<rect width="256" height="256" fill="${bg}"/>` : ''}<g transform="translate(${t} ${t}) scale(${scale})">${body}</g></svg>`;
}

module.exports = { BORDO, WHITE, SOLE, markSvg };
