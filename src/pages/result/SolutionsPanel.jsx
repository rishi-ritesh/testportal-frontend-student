import { useMemo, useState } from "react";

// =========================
// HELPERS
// =========================

const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const getStatus = (q) => {
  if (q.answerStatus === "answered") {
    return q.isCorrect ? "correct" : "incorrect";
  }
  return "unattempted";
};

const STATUS_BADGE = {
  correct: "bg-green-100 text-green-700",
  incorrect: "bg-red-100 text-red-700",
  unattempted: "bg-gray-100 text-gray-600",
};

const STATUS_LABEL = {
  correct: "Correct",
  incorrect: "Incorrect",
  unattempted: "Unattempted",
};

const DIFFICULTY_BADGE = {
  easy: "bg-green-100 text-green-700",
  medium: "bg-amber-100 text-amber-700",
  hard: "bg-red-100 text-red-700",
  unrated: "bg-gray-100 text-gray-500",
};

// option cell colour based on correctness vs selection
const optionClasses = (q, key) => {
  const isCorrect = key === q.correctAnswer;
  const isSelected = key === q.selectedOption;

  if (isCorrect) {
    return "border-green-400 bg-green-50";
  }
  if (isSelected) {
    return "border-red-400 bg-red-50";
  }
  return "border-gray-200";
};

const FILTERS = [
  { key: "all", label: "All" },
  { key: "correct", label: "Correct" },
  { key: "incorrect", label: "Incorrect" },
  { key: "unattempted", label: "Unattempted" },
  { key: "marked", label: "Marked" },
];

function SolutionsPanel({ questions }) {
  const [filter, setFilter] = useState("all");

  const counts = useMemo(() => {
    const c = {
      all: questions.length,
      correct: 0,
      incorrect: 0,
      unattempted: 0,
      marked: 0,
    };
    questions.forEach((q) => {
      c[getStatus(q)]++;
      if (q.markedForReview) c.marked++;
    });
    return c;
  }, [questions]);

  const visible = useMemo(() => {
    if (filter === "all") return questions;
    if (filter === "marked")
      return questions.filter((q) => q.markedForReview);
    return questions.filter((q) => getStatus(q) === filter);
  }, [questions, filter]);

  return (
    <div className="space-y-6">
      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            onClick={() => setFilter(f.key)}
            className={`px-4 py-2 rounded-2xl text-sm font-medium border transition ${
              filter === f.key
                ? "bg-black text-white border-black"
                : "border-gray-300 text-gray-700 hover:border-black"
            }`}
          >
            {f.label}
            <span className="ml-2 opacity-70">{counts[f.key]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border rounded-3xl p-10 text-center text-gray-500">
          No questions in this filter.
        </div>
      ) : (
        visible.map((q) => {
          const status = getStatus(q);
          const difficulty = q.competitionStats?.difficulty;

          return (
            <div
              key={q.questionId}
              className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm"
            >
              {/* Header */}
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-lg font-bold text-gray-900">
                      Q{q.sectionQuestionNumber}
                    </h3>

                    <span
                      className={`text-xs font-medium px-3 py-1 rounded-full ${STATUS_BADGE[status]}`}
                    >
                      {STATUS_LABEL[status]}
                    </span>

                    {q.markedForReview && (
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                        Marked
                      </span>
                    )}

                    {difficulty && (
                      <span
                        className={`text-xs font-medium px-3 py-1 rounded-full capitalize ${
                          DIFFICULTY_BADGE[difficulty] ||
                          "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {difficulty}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-gray-400 mt-2">
                    {q.sectionName} · {q.subjectName} · {q.topicName}
                  </p>
                </div>

                <div className="text-right shrink-0 text-sm">
                  <p
                    className={`font-semibold ${
                      q.marksAwarded > 0
                        ? "text-green-600"
                        : q.marksAwarded < 0
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}
                  >
                    {q.marksAwarded > 0 ? "+" : ""}
                    {q.marksAwarded}
                  </p>
                  <p className="text-gray-400 mt-1">
                    {formatTime(q.timeSpent)}
                  </p>
                </div>
              </div>

              {/* Question */}
              <div
                className="text-gray-900 leading-7 prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html: q.questionText?.english || "",
                }}
              />

              {/* Options */}
              <div className="mt-6 space-y-3">
                {(q.options || []).map((option) => {
                  const isCorrect = option.key === q.correctAnswer;
                  const isSelected = option.key === q.selectedOption;

                  return (
                    <div
                      key={option.key}
                      className={`border rounded-2xl p-4 ${optionClasses(
                        q,
                        option.key
                      )}`}
                    >
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-medium shrink-0 bg-white">
                          {option.key}
                        </div>

                        <div
                          className="prose max-w-none flex-1"
                          dangerouslySetInnerHTML={{
                            __html: option.text?.english || "",
                          }}
                        />

                        <div className="flex flex-col items-end gap-1 shrink-0">
                          {isCorrect && (
                            <span className="text-xs font-medium text-green-700">
                              Correct answer
                            </span>
                          )}
                          {isSelected && (
                            <span
                              className={`text-xs font-medium ${
                                isCorrect
                                  ? "text-green-700"
                                  : "text-red-700"
                              }`}
                            >
                              Your answer
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {status === "unattempted" && (
                <p className="mt-4 text-sm text-gray-500">
                  You did not answer this question.
                </p>
              )}

              {/* Explanation */}
              {q.explanation?.english && (
                <div className="mt-6 bg-gray-50 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Explanation
                  </p>
                  <div
                    className="prose max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{
                      __html: q.explanation.english,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default SolutionsPanel;
