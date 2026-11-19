import { BRAND } from "../config/brand";

// The AdhyayanSetu emblem with the name as real text (readable by Google and
// screen readers). `height` is the emblem height in px; `showName` hides the
// text where space is tight. `smallHeight` (optional) is the emblem height on
// phones (below 640px); `height` is used from 640px up.
function BrandLogo({ height = 36, smallHeight, showName = true, textClassName = "text-xl" }) {
  const width = Math.round(height * BRAND.emblemRatio);

  // the emblem never shrinks inside a flex row; with smallHeight its size
  // switches at the sm breakpoint through CSS variables
  const sizeStyle = smallHeight
    ? {
        "--logo-w": `${Math.round(smallHeight * BRAND.emblemRatio)}px`,
        "--logo-h": `${smallHeight}px`,
        "--logo-w-sm": `${width}px`,
        "--logo-h-sm": `${height}px`,
      }
    : { width, height, minWidth: width };
  const sizeClass = smallHeight
    ? "block w-(--logo-w) h-(--logo-h) min-w-(--logo-w) sm:w-(--logo-w-sm) sm:h-(--logo-h-sm) sm:min-w-(--logo-w-sm)"
    : "block";

  return (
    <span className="flex items-center gap-2.5 shrink-0">
      <picture className="block shrink-0">
        <source type="image/webp" srcSet={`${BRAND.emblem} 1x, ${BRAND.emblem2x} 2x`} />
        <img
          src={BRAND.emblemPng}
          width={width}
          height={height}
          alt={showName ? "" : `${BRAND.name} logo`}
          className={sizeClass}
          style={sizeStyle}
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
