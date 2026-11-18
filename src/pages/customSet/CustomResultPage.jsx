import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

import { getCustomSetResult } from "../../services/test.service";
import { drawMathInHtml } from "../../lib/math";

// =========================
// HELPERS
// =========================

const pickText = (textObj, lang) => {
  if (!textObj) return "";
  return lang === "hi"
    ? textObj.hindi || textObj.english || ""
    : textObj.english || textObj.hindi || "";
};

// 75 → "1m 15s"
const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return m ? `${m}m ${sec}s` : `${sec}s`;
};

// The result is worked out here in the browser — the server only stores what
// the student picked. No marks, just one of four statuses per question.
const statusOf = (q) => {
  if (q.selectedOption) {
    return q.selectedOption === q.correctOption ? "correct" : "incorrect";
  }
  return q.visited ? "skipped" : "unseen";
};

const STATUS = {
  correct: { label: "Correct", badge: "bg-green-100 text-green-700", tile: "bg-green-50 text-green-700" },
  incorrect: { label: "Incorrect", badge: "bg-red-100 text-red-700", tile: "bg-red-50 text-red-700" },
  skipped: { label: "Skipped", badge: "bg-orange-100 text-orange-700", tile: "bg-orange-50 text-orange-700" },
  unseen: { label: "Unseen", badge: "bg-gray-100 text-gray-600", tile: "bg-gray-50 text-gray-600" },
};

const FILTERS = ["all", "correct", "incorrect", "skipped", "unseen"];

function CustomResultPage() {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [filter, setFilter] = useState("all");
  const [sortBySlowest, setSortBySlowest] = useState(false);
  const [openExplanations, setOpenExplanations] = useState(() => new Set());
  const [lang, setLang] = useState(() => localStorage.getItem("testLang") || "en");

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem("testLang", next);
  };

  useEffect(() => {
    getCustomSetResult()
      .then(setResult)
      .catch((err) => setError(err.response?.data?.message || "Failed to load result"))
      .finally(() => setLoading(false));
  }, []);

  const questions = useMemo(
    () => (result?.questions || []).map((q) => ({ ...q, status: statusOf(q) })),
    [result]
  );

  const counts = useMemo(() => {
    const c = { correct: 0, incorrect: 0, skipped: 0, unseen: 0 };
    questions.forEach((q) => c[q.status]++);
    return c;
  }, [questions]);

  const shown = useMemo(() => {
    const list = filter === "all" ? questions : questions.filter((q) => q.status === filter);
    return sortBySlowest ? [...list].sort((a, b) => b.timeSpent - a.timeSpent) : list;
  }, [questions, filter, sortBySlowest]);

  if (loading) return <div className="text-lg font-medium">Loading result...</div>;

  if (error) {
    return (
      <div className="max-w-5xl mx-auto space-y-4">
        <div className="text-red-600 font-medium">{error}</div>
        <Link to="/custom-set" className="text-indigo-700 font-semibold underline">
          Back to my custom set
        </Link>
      </div>
    );
  }

  const attempted = counts.correct + counts.incorrect;
  const accuracy = attempted ? Math.round((counts.correct / attempted) * 100) : 0;
  const answeredTimes = questions.filter((q) => q.timeSpent > 0);
  const avgTime = answeredTimes.length
    ? answeredTimes.reduce((sum, q) => sum + q.timeSpent, 0) / answeredTimes.length
    : 0;

  const toggleExplanation = (id) =>
    setOpenExplanations((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ================= SUMMARY ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 px-8 py-6 flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-white text-xl font-bold">🎯 Custom Practice Result</h1>
            <p className="text-indigo-100 text-sm mt-1">
              {questions.length} questions
              {result.submittedAt && ` · ${new Date(result.submittedAt).toLocaleString()}`}
              {result.autoSubmitted && " · auto-submitted when time ran out"}
            </p>
          </div>
          <Link
            to="/custom-set"
            className="px-4 py-2 rounded-xl text-sm font-medium bg-white text-indigo-700 hover:opacity-90"
          >
            Back to my set
          </Link>
        </div>

        <div className="p-6 grid grid-cols-2 md:grid-cols-4 gap-4">
          {["correct", "incorrect", "skipped", "unseen"].map((k) => (
            <button
              key={k}
              onClick={() => setFilter(filter === k ? "all" : k)}
              className={`rounded-2xl p-4 text-left transition ring-offset-2 ${STATUS[k].tile} ${
                filter === k ? "ring-2 ring-indigo-500" : ""
              }`}
            >
              <p className="text-2xl font-bold">{counts[k]}</p>
              <p className="text-sm">{STATUS[k].label}</p>
            </button>
          ))}
        </div>

        <div className="px-6 pb-6 grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-gray-500">Time taken</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {formatTime(result.timeTakenSeconds)}
              <span className="text-gray-400 font-normal"> / {formatTime(result.totalSeconds)}</span>
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-gray-500">Average per question seen</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">{formatTime(avgTime)}</p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-gray-500">Time allowed per question</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {formatTime(result.secondsPerQuestion)}
            </p>
          </div>
          <div className="rounded-2xl border border-gray-200 p-4">
            <p className="text-gray-500">Accuracy (of attempted)</p>
            <p className="text-lg font-semibold text-gray-900 tabular-nums">
              {attempted ? `${accuracy}%` : "—"}
            </p>
          </div>
        </div>
      </section>

      {/* ================= CONTROLS ================= */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {FILTERS.map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-4 py-2 rounded-xl text-sm font-medium border transition ${
                filter === f
                  ? "bg-black text-white border-black"
                  : "bg-white text-gray-700 border-gray-300 hover:border-black"
              }`}
            >
              {f === "all" ? `All (${questions.length})` : `${STATUS[f].label} (${counts[f]})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={sortBySlowest}
              onChange={(e) => setSortBySlowest(e.target.checked)}
            />
            Slowest first
          </label>
          <div className="flex items-center rounded-xl border border-gray-300 overflow-hidden">
            <button
              onClick={() => changeLang("en")}
              className={`px-3 py-1.5 text-sm font-medium ${
                lang === "en" ? "bg-black text-white" : "bg-white text-gray-600"
              }`}
            >
              English
            </button>
            <button
              onClick={() => changeLang("hi")}
              className={`px-3 py-1.5 text-sm font-medium ${
                lang === "hi" ? "bg-black text-white" : "bg-white text-gray-600"
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </div>

      {/* ================= QUESTIONS ================= */}
      {shown.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center text-gray-500">
          No questions in this group.
        </div>
      ) : (
        shown.map((q) => {
          const id = String(q.questionId);
          const st = STATUS[q.status];
          const hasExplanation = q.explanation?.english || q.explanation?.hindi;
          return (
            <div key={id} className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
              <div className="flex items-start justify-between gap-4 mb-4">
                <div>
                  <div className="flex items-center gap-3">
                    <h3 className="text-lg font-bold text-gray-900">Question {q.questionNumber}</h3>
                    <span className={`text-xs font-semibold px-3 py-1 rounded-full ${st.badge}`}>
                      {st.label}
                    </span>
                    {q.markedForReview && (
                      <span className="text-xs font-medium px-3 py-1 rounded-full bg-purple-100 text-purple-700">
                        Marked
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-gray-400 mt-2">
                    {[q.subjectName, q.topicName].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-semibold text-gray-900 tabular-nums">
                    ⏱ {formatTime(q.timeSpent)}
                  </p>
                  <p className="text-xs text-gray-400">time spent</p>
                </div>
              </div>

              <div
                className="text-gray-900 leading-7 prose max-w-none"
                dangerouslySetInnerHTML={{ __html: drawMathInHtml(pickText(q.question, lang)) }}
              />

              <div className="mt-6 space-y-3">
                {q.options.map((opt) => {
                  const isCorrect = opt.key === q.correctOption;
                  const isPicked = opt.key === q.selectedOption;
                  const tone = isCorrect
                    ? "border-green-400 bg-green-50"
                    : isPicked
                    ? "border-red-400 bg-red-50"
                    : "border-gray-200";
                  return (
                    <div key={opt.key} className={`border rounded-2xl p-4 ${tone}`}>
                      <div className="flex items-start gap-4">
                        <div className="w-8 h-8 rounded-full border border-gray-300 flex items-center justify-center font-medium shrink-0 bg-white">
                          {opt.key}
                        </div>
                        <div
                          className="prose max-w-none flex-1"
                          dangerouslySetInnerHTML={{ __html: drawMathInHtml(pickText(opt.text, lang)) }}
                        />
                        <div className="text-xs font-medium shrink-0 text-right">
                          {isCorrect && <p className="text-green-700">Correct answer</p>}
                          {isPicked && (
                            <p className={isCorrect ? "text-green-700" : "text-red-700"}>Your answer</p>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {hasExplanation && (
                <div className="mt-6">
                  <button
                    onClick={() => toggleExplanation(id)}
                    className="text-sm font-semibold text-indigo-700 hover:underline"
                  >
                    {openExplanations.has(id) ? "Hide explanation" : "Show explanation"}
                  </button>
                  {openExplanations.has(id) && (
                    <div className="mt-3 bg-gray-50 rounded-2xl p-5">
                      <div
                        className="prose max-w-none text-gray-700"
                        dangerouslySetInnerHTML={{ __html: drawMathInHtml(pickText(q.explanation, lang)) }}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })
      )}
    </div>
  );
}

export default CustomResultPage;
