import { useNavigate } from "react-router-dom";

import { LABEL_STYLE, mockActions } from "../lib/attemptActions";

// "Attempted" / "In progress" pill for a mock (nothing when not started).
export function MockStatusLabel({ attempt }) {
  const { label } = mockActions("", attempt);
  if (!label) return null;
  return (
    <span
      className={`inline-block align-middle text-xs font-semibold px-2 py-0.5 rounded-full ${LABEL_STYLE[label]}`}
    >
      {label}
    </span>
  );
}

// Start / Resume / View Result + Re-attempt buttons for one mock.
// `full` stretches the buttons to the full width (cards).
function MockActions({ testId, attempt, full = false }) {
  const navigate = useNavigate();
  const { primary, secondary } = mockActions(testId, attempt);

  const size = full ? "flex-1 py-3 rounded-2xl" : "flex-1 sm:flex-none py-2 rounded-lg";

  return (
    <div className={`flex flex-wrap gap-2 ${full ? "w-full" : "w-full sm:w-auto"}`}>
      <button
        onClick={() => navigate(primary.to)}
        className={`${size} min-h-10 px-4 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium whitespace-nowrap transition`}
      >
        {primary.text}
      </button>
      {secondary && (
        <button
          onClick={() => navigate(secondary.to)}
          className={`${size} min-h-10 px-4 border border-blue-600 text-blue-700 hover:bg-blue-50 text-sm font-medium whitespace-nowrap transition`}
        >
          {secondary.text}
        </button>
      )}
    </div>
  );
}

export default MockActions;
