import { BRAND } from "../config/brand";

// The AdhyayanSetu emblem with the name as real text (readable by Google and
// screen readers). `height` is the emblem height in px; `showName` hides the
// text where space is tight.
function BrandLogo({ height = 36, showName = true, textClassName = "text-xl" }) {
  const width = Math.round(height * BRAND.emblemRatio);

  return (
    <span className="flex items-center gap-2.5 shrink-0">
      <picture className="block shrink-0">
        <source type="image/webp" srcSet={`${BRAND.emblem} 1x, ${BRAND.emblem2x} 2x`} />
        <img
          src={BRAND.emblemPng}
          width={width}
          height={height}
          alt={showName ? "" : `${BRAND.name} logo`}
          className="block"
          style={{ width, height, minWidth: width }}
        />
      </picture>
      {showName && (
        <span className={`${textClassName} font-bold tracking-tight text-[#0B2357] whitespace-nowrap`}>
          {BRAND.name}
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
