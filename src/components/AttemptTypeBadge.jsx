// "Ranked" / "Practice" pill next to a test name in attempt lists.
const STYLE = {
  ranked: { text: "Ranked", className: "bg-blue-100 text-blue-800" },
  practice: { text: "Practice", className: "bg-amber-100 text-amber-800" },
};

function AttemptTypeBadge({ type }) {
  const badge = STYLE[type];
  if (!badge) return null;
  return (
    <span
      className={`shrink-0 mt-0.5 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.className}`}
    >
      {badge.text}
    </span>
  );
}

export default AttemptTypeBadge;
