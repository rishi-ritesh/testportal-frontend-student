import { useNavigate } from "react-router-dom";

const STATUS_BADGE = {
  completed: "bg-green-100 text-green-700",
  in_progress: "bg-amber-100 text-amber-700",
  paused: "bg-gray-100 text-gray-700",
};

const STATUS_LABEL = {
  completed: "Completed",
  in_progress: "In progress",
  paused: "Paused",
};

const formatDate = (value) => {
  if (!value) return "";
  try {
    return new Date(value).toLocaleString(undefined, {
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return "";
  }
};

function AttemptCard({ attempt }) {
  const navigate = useNavigate();

  const isCompleted = attempt.status === "completed";

  return (
    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-gray-900">
            {attempt.testTitle}
          </h2>
          {attempt.attemptType && (
            <p className="text-sm text-gray-500 mt-0.5">
              {attempt.attemptType === "ranked"
                ? "First Attempt · Ranked"
                : "Practice Attempt"}
            </p>
          )}
        </div>

        <span
          className={`shrink-0 text-xs font-medium px-3 py-1 rounded-full ${
            STATUS_BADGE[attempt.status] || "bg-gray-100 text-gray-700"
          }`}
        >
          {STATUS_LABEL[attempt.status] || attempt.status}
        </span>
      </div>

      {isCompleted ? (
        <div className="mt-5 grid grid-cols-3 gap-3 text-sm">
          <div>
            <p className="text-gray-500">Score</p>
            <p className="font-semibold text-gray-900">
              {attempt.finalScore}
            </p>
          </div>
          <div>
            <p className="text-gray-500">Accuracy</p>
            <p className="font-semibold text-gray-900">
              {attempt.accuracy}%
            </p>
          </div>
          <div>
            <p className="text-gray-500">Rank</p>
            <p className="font-semibold text-gray-900">
              {attempt.rank ?? "—"}
            </p>
          </div>
        </div>
      ) : (
        <p className="mt-5 text-sm text-gray-500">
          {attempt.totalQuestions} questions · started{" "}
          {formatDate(attempt.startedAt)}
        </p>
      )}

      {isCompleted && (
        <p className="mt-3 text-xs text-gray-400">
          {formatDate(attempt.updatedAt)}
        </p>
      )}

      <button
        onClick={() =>
          navigate(
            isCompleted
              ? `/result/${attempt.attemptId}`
              : `/attempt/${attempt.attemptId}`
          )
        }
        className={`mt-6 w-full py-3 rounded-2xl font-medium transition ${
          isCompleted
            ? "border border-gray-300 hover:border-black"
            : "bg-black text-white hover:opacity-90"
        }`}
      >
        {isCompleted ? "View Result" : "Resume Test"}
      </button>
    </div>
  );
}

export default AttemptCard;
