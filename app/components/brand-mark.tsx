// SoleCost marka işareti: bordo zemin, beyaz taban silüeti, bordo "SC" (scripts/brand/mark.js ile aynı çizim).
const SOLE = 'M60 92 Q82 76 112 76 L182 76 Q204 76 214 94 L226 138 Q228 162 214 174 L192 190 Q180 196 160 196 L92 196 Q68 196 52 184 L36 168 Q30 150 36 132 Z';
export const BRAND_BORDO = '#6B1A2C';

export function BrandMark({ size = 36, className = '' }: { size?: number; className?: string }) {
  return (
    <svg viewBox="0 0 256 256" width={size} height={size} role="img" aria-label="SoleCost"
      className={`shrink-0 rounded-[22%] shadow-lg shadow-black/20 ${className}`}>
      <rect width="256" height="256" fill={BRAND_BORDO} />
      <g transform="translate(-15.36 -15.36) scale(1.12)">
        <path d={SOLE} fill="#fff" />
        <text x="131" y="138" fill={BRAND_BORDO} fontFamily="Inter, 'Helvetica Neue', Arial, sans-serif" fontSize="74" fontWeight="800"
          letterSpacing="2" textAnchor="middle" dominantBaseline="central">SC</text>
      </g>
    </svg>
  );
}
