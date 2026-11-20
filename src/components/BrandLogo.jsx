import { BRAND } from "../config/brand";

// The site logo: a blue rounded tile with a white "T", plus the name as real
// text. `height` is the tile size in px; `showName` hides the text where
// space is tight. `smallHeight` (optional) is the tile size on phones (below
// 640px); `height` is used from 640px up.
function BrandLogo({ height = 36, smallHeight, showName = true, textClassName = "text-xl" }) {
  const font = (size) => `${Math.round(size * 0.45)}px`;

  // the tile never shrinks inside a flex row; with smallHeight its size
  // switches at the sm breakpoint through CSS variables
  const sizeStyle = smallHeight
    ? {
        "--logo": `${smallHeight}px`,
        "--logo-font": font(smallHeight),
        "--logo-sm": `${height}px`,
        "--logo-font-sm": font(height),
      }
    : { width: height, height, minWidth: height, fontSize: font(height) };
  const sizeClass = smallHeight
    ? "w-(--logo) h-(--logo) min-w-(--logo) text-(length:--logo-font) sm:w-(--logo-sm) sm:h-(--logo-sm) sm:min-w-(--logo-sm) sm:text-(length:--logo-font-sm)"
    : "";

  return (
    <span className="flex items-center gap-2.5 shrink-0">
      <span
        aria-hidden="true"
        className={`flex items-center justify-center shrink-0 rounded-[28%] bg-gradient-to-br from-blue-700 to-blue-500 text-white font-bold leading-none shadow-sm ${sizeClass}`}
        style={sizeStyle}
      >
        T
      </span>
      {showName && (
        <span className={`${textClassName} font-bold text-gray-900 whitespace-nowrap`}>
          {BRAND.name}
        </span>
      )}
    </span>
  );
}

export default BrandLogo;
