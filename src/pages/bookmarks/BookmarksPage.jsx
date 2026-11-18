import { useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { getBookmarks, toggleBookmark } from "../../services/test.service";
import { drawMathInHtml } from "../../lib/math";

const pickText = (textObj, lang) => {
  if (!textObj) return "";
  return lang === "hi"
    ? textObj.hindi || textObj.english || ""
    : textObj.english || textObj.hindi || "";
};

function BookmarksPage() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lang, setLang] = useState(
    () => localStorage.getItem("testLang") || "en"
  );

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem("testLang", next);
  };

  useEffect(() => {
    getBookmarks()
      .then(setItems)
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load bookmarks")
      )
      .finally(() => setLoading(false));
  }, []);

  const removeBookmark = async (questionId) => {
    setNotice("");
    // optimistic remove
    const prev = items;
    setItems((list) => list.filter((q) => String(q.questionId) !== String(questionId)));
    try {
      await toggleBookmark(questionId);
    } catch (err) {
      setItems(prev); // revert
      // bookmark lock: the question is in the custom practice set
      setNotice(
        err.response?.data?.message || "Couldn't remove the bookmark. Please try again."
      );
    }
  };

  if (loading) {
    return <div className="text-lg font-medium">Loading bookmarks...</div>;
  }

  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* ================= HEADER ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 flex items-center justify-between gap-4">
          <h1 className="text-white text-lg font-bold tracking-wide flex items-center gap-3">
            <span className="text-2xl">🔖</span>
            MY BOOKMARKS
            <span className="text-sm font-medium bg-white/15 px-3 py-1 rounded-full">
              {items.length}
            </span>
          </h1>

          {/* Language toggle */}
          <div className="flex items-center rounded-xl bg-white/10 overflow-hidden">
            <button
              onClick={() => changeLang("en")}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                lang === "en" ? "bg-white text-blue-700" : "text-white"
              }`}
            >
              English
            </button>
            <button
              onClick={() => changeLang("hi")}
              className={`px-3 py-1.5 text-sm font-medium transition ${
                lang === "hi" ? "bg-white text-blue-700" : "text-white"
              }`}
            >
              हिंदी
            </button>
          </div>
        </div>
      </section>

      {/* ================= CUSTOM SET SHORTCUT ================= */}
      <Link
        to="/custom-set"
        className="flex items-center justify-between gap-4 bg-indigo-50 border border-indigo-200 rounded-3xl px-6 py-4 hover:bg-indigo-100 transition"
      >
        <div>
          <p className="font-semibold text-indigo-900">🎯 Practise these as a timed test</p>
          <p className="text-sm text-indigo-700">
            Build your custom practice set ({items.filter((q) => q.inCustomSet).length} of your
            bookmarks are in it).
          </p>
        </div>
        <span className="text-indigo-700 font-semibold">Open →</span>
      </Link>

      {notice && (
        <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl px-5 py-3 text-sm flex items-center justify-between gap-4">
          <span>{notice}</span>
          <Link to="/custom-set" className="font-semibold underline shrink-0">
            Go to custom set
          </Link>
        </div>
      )}

      {items.length === 0 ? (
        <div className="bg-white border border-gray-200 rounded-3xl p-10 text-center text-gray-500">
          You haven't bookmarked any questions yet. Open a completed test's
          Solutions and tap the ☆ to save questions for revision.
        </div>
      ) : (
        items.map((q) => (
          <div
            key={q.questionId}
            className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm"
          >
            {/* Header */}
            <div className="flex items-start justify-between gap-4 mb-4">
              <p className="text-xs text-gray-400">
                {[q.subjectName, q.topicName, q.questionCode]
                  .filter(Boolean)
                  .join(" · ")}
                {q.inCustomSet && (
                  <span className="ml-2 text-[11px] font-semibold text-indigo-700 bg-indigo-100 px-2 py-0.5 rounded-lg">
                    In custom set
                  </span>
                )}
              </p>

              <button
                onClick={() => removeBookmark(q.questionId)}
                title={
                  q.inCustomSet
                    ? "In your custom set — remove it from the set first"
                    : "Remove bookmark"
                }
                className="shrink-0 text-xl leading-none text-amber-500 hover:text-red-500 transition"
              >
                ★
              </button>
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
                return (
                  <div
                    key={option.key}
                    className={`border rounded-2xl p-4 ${
                      isCorrect ? "border-green-400 bg-green-50" : "border-gray-200"
                    }`}
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
                      {isCorrect && (
                        <span className="text-xs font-medium text-green-700 shrink-0">
                          Correct answer
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

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
        ))
      )}
    </div>
  );
}

export default BookmarksPage;
