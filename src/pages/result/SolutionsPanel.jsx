import { useEffect, useMemo, useState } from "react";

import { getBookmarkIds, toggleBookmark } from "../../services/test.service";
import { drawMathInHtml } from "../../lib/math";

// =========================
// HELPERS
// =========================

const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

// Pick text for the chosen language, falling back to the other so nothing is
// blank if a translation is missing.
const pickText = (textObj, lang) => {
  if (!textObj) return "";
  return lang === "hi"
    ? textObj.hindi || textObj.english || ""
    : textObj.english || textObj.hindi || "";
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

// Shared by the status row and the subject row.
const ALL = "all";

// A question's subject, with a fallback so an unlabelled one still groups
// somewhere instead of vanishing from every subject.
const subjectOf = (q) => q.subjectName || "Unspecified";

const matchesStatus = (q, key) => {
  if (key === ALL) return true;
  if (key === "marked") return Boolean(q.markedForReview);
  return getStatus(q) === key;
};

const matchesSubject = (q, name) => name === ALL || subjectOf(q) === name;

function SolutionsPanel({ questions }) {
  const [filter, setFilter] = useState(ALL);
  const [subject, setSubject] = useState(ALL);
  const [lang, setLang] = useState(
    () => localStorage.getItem("testLang") || "en"
  );
  const [bookmarked, setBookmarked] = useState(() => new Set());
  const [bmNotice, setBmNotice] = useState("");

  // hide the bookmark-lock message after a few seconds
  useEffect(() => {
    if (!bmNotice) return;
    const id = setTimeout(() => setBmNotice(""), 5000);
    return () => clearTimeout(id);
  }, [bmNotice]);

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem("testLang", next);
  };

  // seed which questions are already bookmarked
  useEffect(() => {
    getBookmarkIds()
      .then((ids) => setBookmarked(new Set(ids.map(String))))
      .catch(() => {});
  }, []);

  const toggleBm = async (questionId) => {
    const key = String(questionId);
    const flip = (set) => {
      const n = new Set(set);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    };

    setBookmarked(flip); // optimistic
    try {
      const res = await toggleBookmark(questionId);
      setBookmarked((prev) => {
        const n = new Set(prev);
        if (res.bookmarked) n.add(key);
        else n.delete(key);
        return n;
      });
    } catch (err) {
      setBookmarked(flip); // revert
      // bookmark lock: the question is in the custom practice set
      if (err.response?.status === 409) {
        setBmNotice(err.response.data?.message || "");
      }
    }
  };

  // Subjects in the order they first appear, so the row follows the order of
  // the paper rather than the alphabet.
  const subjects = useMemo(() => {
    const seen = [];
    questions.forEach((q) => {
      const name = subjectOf(q);
      if (!seen.includes(name)) seen.push(name);
    });
    return seen;
  }, [questions]);

  // Each row is counted against the *other* row's choice, so every number says
  // how many questions that button would actually show if clicked.
  const counts = useMemo(() => {
    const c = { all: 0, correct: 0, incorrect: 0, unattempted: 0, marked: 0 };
    questions.forEach((q) => {
      if (!matchesSubject(q, subject)) return;
      c.all++;
      c[getStatus(q)]++;
      if (q.markedForReview) c.marked++;
    });
    return c;
  }, [questions, subject]);

  const subjectCounts = useMemo(() => {
    const c = { [ALL]: 0 };
    subjects.forEach((s) => (c[s] = 0));
    questions.forEach((q) => {
      if (!matchesStatus(q, filter)) return;
      c[ALL]++;
      c[subjectOf(q)]++;
    });
    return c;
  }, [questions, subjects, filter]);

  const visible = useMemo(
    () =>
      questions.filter(
        (q) => matchesStatus(q, filter) && matchesSubject(q, subject)
      ),
    [questions, filter, subject]
  );

  return (
    <div className="space-y-6">
      {/* Bookmark lock message (question is in the custom practice set) */}
      {bmNotice && (
        <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-gray-900 text-white text-sm px-5 py-3 rounded-2xl shadow-lg max-w-md text-center">
          {bmNotice}
        </div>
      )}

      {/* Filters + language */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
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

          {/* Language toggle */}
          <div className="flex items-center rounded-xl border border-gray-300 overflow-hidden">
            <button
              onClick={() => changeLang("en")}
              className={`px-3 py-2 text-sm font-medium transition ${
                lang === "en"
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 hover:text-black"
              }`}
            >
              English
            </button>
            <button
              onClick={() => changeLang("hi")}
              className={`px-3 py-2 text-sm font-medium transition ${
                lang === "hi"
                  ? "bg-black text-white"
                  : "bg-white text-gray-600 hover:text-black"
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>

        {/* Subject row — pointless when the paper has only one subject */}
        {subjects.length > 1 && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-wide text-gray-400 mr-1">
              Subject
            </span>
            {[ALL, ...subjects].map((s) => (
              <button
                key={s}
                onClick={() => setSubject(s)}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition ${
                  subject === s
                    ? "bg-gray-900 text-white border-gray-900"
                    : "border-gray-300 text-gray-600 hover:border-gray-900"
                } ${
                  subjectCounts[s] === 0 && subject !== s ? "opacity-40" : ""
                }`}
              >
                {s === ALL ? "All Subjects" : s}
                <span className="ml-2 opacity-70">{subjectCounts[s]}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border rounded-3xl p-10 text-center text-gray-500">
          No questions match these filters.
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

                <div className="flex flex-col items-end gap-2 shrink-0">
                  <button
                    onClick={() => toggleBm(q.questionId)}
                    title={
                      bookmarked.has(String(q.questionId))
                        ? "Remove bookmark"
                        : "Bookmark this question"
                    }
                    className={`text-xl leading-none transition ${
                      bookmarked.has(String(q.questionId))
                        ? "text-amber-500"
                        : "text-gray-300 hover:text-amber-500"
                    }`}
                  >
                    {bookmarked.has(String(q.questionId)) ? "★" : "☆"}
                  </button>

                  <div className="text-right text-sm">
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
              </div>

              {/* Question */}
              <div
                className="text-gray-900 leading-7 prose max-w-none"
                dangerouslySetInnerHTML={{
                  __html: drawMathInHtml(pickText(q.questionText, lang)),
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
                            __html: drawMathInHtml(pickText(option.text, lang)),
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
              {(q.explanation?.english || q.explanation?.hindi) && (
                <div className="mt-6 bg-gray-50 rounded-2xl p-5">
                  <p className="text-sm font-semibold text-gray-700 mb-2">
                    Explanation
                  </p>
                  <div
                    className="prose max-w-none text-gray-700"
                    dangerouslySetInnerHTML={{
                      __html: drawMathInHtml(pickText(q.explanation, lang)),
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
