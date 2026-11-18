import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  getCustomSet,
  getBookmarks,
  addToCustomSet,
  removeFromCustomSet,
  clearCustomSet,
  updateCustomSetTimer,
  startCustomSet,
} from "../../services/test.service";
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

// 1000 → "16 min 40 s"
const formatDuration = (totalSeconds) => {
  const s = Math.max(0, Math.round(totalSeconds || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return [h && `${h} h`, m && `${m} min`, sec && `${sec} s`]
    .filter(Boolean)
    .join(" ") || "0 s";
};

const ALL = "__all__";

function ConfirmCard({ icon, title, text, confirmLabel, danger, busy, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-white rounded-3xl p-10 max-w-sm mx-4 shadow-xl text-center">
        <div className="text-4xl mb-3">{icon}</div>
        <h2 className="text-2xl font-bold text-gray-900">{title}</h2>
        <p className="text-gray-500 mt-3 text-sm">{text}</p>
        <div className="mt-6 space-y-3">
          <button
            onClick={onConfirm}
            disabled={busy}
            className={`w-full text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40 ${
              danger ? "bg-red-600" : "bg-black"
            }`}
          >
            {busy ? "Please wait..." : confirmLabel}
          </button>
          <button
            onClick={onCancel}
            disabled={busy}
            className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function CustomSetPage() {
  const navigate = useNavigate();

  const [setData, setSetData] = useState(null);
  const [bookmarks, setBookmarks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [lang] = useState(() => localStorage.getItem("testLang") || "en");

  // timer field (string so the student can type freely)
  const [timerInput, setTimerInput] = useState("");

  // "add from bookmarks" panel
  const [subject, setSubject] = useState(ALL);
  const [selected, setSelected] = useState(() => new Set());
  const [randomCount, setRandomCount] = useState("");

  const [confirm, setConfirm] = useState(null); // "clear" | "restart" | null

  // =========================
  // LOAD
  // =========================

  const applySet = (data) => {
    setSetData(data);
    setTimerInput(String(data.secondsPerQuestion));
  };

  const reloadBookmarks = () =>
    getBookmarks()
      .then(setBookmarks)
      .catch(() => {});

  useEffect(() => {
    Promise.all([getCustomSet(), getBookmarks()])
      .then(([s, b]) => {
        applySet(s);
        setBookmarks(b);
      })
      .catch((err) => setError(err.response?.data?.message || "Failed to load your custom set"))
      .finally(() => setLoading(false));
  }, []);

  // Run an action, show its error (if any), refresh the set view.
  const run = async (fn, { refreshBookmarks = false, okMessage = "" } = {}) => {
    setBusy(true);
    setError("");
    setNotice("");
    try {
      const data = await fn();
      if (data?.questions) applySet(data);
      if (refreshBookmarks) await reloadBookmarks();
      if (okMessage) setNotice(okMessage);
      return true;
    } catch (err) {
      setError(err.response?.data?.message || "Something went wrong");
      return false;
    } finally {
      setBusy(false);
    }
  };

  // =========================
  // DERIVED
  // =========================

  const inSetIds = useMemo(
    () => new Set((setData?.questions || []).map((q) => String(q.questionId))),
    [setData]
  );

  // bookmarks that can still be added
  const candidates = useMemo(
    () => bookmarks.filter((b) => !inSetIds.has(String(b.questionId))),
    [bookmarks, inSetIds]
  );

  const subjects = useMemo(() => {
    const seen = [];
    candidates.forEach((b) => {
      const name = b.subjectName || "Other";
      if (!seen.includes(name)) seen.push(name);
    });
    return seen;
  }, [candidates]);

  const shown = useMemo(
    () =>
      subject === ALL
        ? candidates
        : candidates.filter((b) => (b.subjectName || "Other") === subject),
    [candidates, subject]
  );

  // only count selections that can still be added (ignores ones already in set)
  const selectedIds = useMemo(() => {
    const valid = new Set(candidates.map((b) => String(b.questionId)));
    return [...selected].filter((id) => valid.has(id));
  }, [selected, candidates]);

  if (loading) {
    return <div className="text-lg font-medium">Loading your custom set...</div>;
  }

  if (!setData) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  const { counts, limits, locked } = setData;
  const runInfo = setData.run;
  const hasResult = runInfo?.status === "submitted";
  const room = counts.room;

  const timerValue = Number(timerInput);
  const timerValid =
    Number.isInteger(timerValue) &&
    timerValue >= limits.MIN_SECONDS_PER_QUESTION &&
    timerValue <= limits.MAX_SECONDS_PER_QUESTION;
  const timerChanged = timerValid && timerValue !== setData.secondsPerQuestion;

  // =========================
  // ACTIONS
  // =========================

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const selectAllShown = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      shown.forEach((b) => next.add(String(b.questionId)));
      return next;
    });

  const pickRandom = () => {
    const n = Math.min(Number(randomCount) || 0, shown.length, room);
    if (n <= 0) return;
    const pool = shown
      .map((b) => String(b.questionId))
      .sort(() => Math.random() - 0.5)
      .slice(0, n);
    setSelected(new Set(pool));
  };

  const addSelected = async () => {
    const ids = selectedIds;
    const ok = await run(() => addToCustomSet(ids), {
      okMessage: `Added ${ids.length} question${ids.length === 1 ? "" : "s"} to your set.`,
    });
    if (ok) {
      setSelected(new Set());
      setRandomCount("");
      reloadBookmarks();
    }
  };

  const removeOne = (questionId) =>
    run(() => removeFromCustomSet(questionId), { refreshBookmarks: true });

  const saveTimer = () =>
    run(() => updateCustomSetTimer(timerValue), { okMessage: "Timer updated." });

  const resetTimer = () => {
    setTimerInput(String(limits.DEFAULT_SECONDS_PER_QUESTION));
    run(() => updateCustomSetTimer(limits.DEFAULT_SECONDS_PER_QUESTION), {
      okMessage: "Timer reset to default.",
    });
  };

  const doClear = async () => {
    const ok = await run(() => clearCustomSet(), { refreshBookmarks: true, okMessage: "Your set is now empty." });
    if (ok) setConfirm(null);
  };

  const doStart = async () => {
    setBusy(true);
    setError("");
    try {
      await startCustomSet();
      navigate("/custom-set/attempt");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start");
      setConfirm(null);
      setBusy(false);
    }
  };

  // Start: if there's an old result, warn first that it will be replaced.
  const onStartClick = () => {
    if (hasResult) setConfirm("restart");
    else doStart();
  };

  // =========================
  // RENDER
  // =========================

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {confirm === "clear" && (
        <ConfirmCard
          icon="🗑"
          title="Clear the whole set?"
          text={
            hasResult
              ? "All questions will be removed from your set and your last result will be deleted. Your bookmarks stay as they are."
              : "All questions will be removed from your set. Your bookmarks stay as they are."
          }
          confirmLabel="Clear set"
          danger
          busy={busy}
          onConfirm={doClear}
          onCancel={() => setConfirm(null)}
        />
      )}

      {confirm === "restart" && (
        <ConfirmCard
          icon="🔁"
          title="Start again?"
          text="Starting again will replace your last result. It can't be brought back."
          confirmLabel="Start new test"
          busy={busy}
          onConfirm={doStart}
          onCancel={() => setConfirm(null)}
        />
      )}

      {/* ================= HEADER ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-indigo-800 to-indigo-600 px-6 py-5 flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-white text-lg font-bold tracking-wide flex items-center gap-3">
              <span className="text-2xl">🎯</span>
              MY CUSTOM PRACTICE SET
              <span className="text-sm font-medium bg-white/15 px-3 py-1 rounded-full">
                {counts.total} / {limits.MAX_QUESTIONS}
              </span>
            </h1>
            <p className="text-indigo-100 text-sm mt-1">
              Practise your bookmarked questions as a timed test. No marks — just
              correct, incorrect, skipped and unseen, with time per question.
            </p>
          </div>

          <div className="flex items-center gap-3">
            {hasResult && !locked && (
              <Link
                to="/custom-set/result"
                className="px-4 py-2 rounded-xl text-sm font-medium bg-white/15 text-white hover:bg-white/25"
              >
                View last result
              </Link>
            )}

            {locked ? (
              <button
                onClick={() => navigate("/custom-set/attempt")}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-white text-indigo-700 hover:opacity-90"
              >
                ▶ {runInfo.status === "paused" ? "Resume test" : "Continue test"}
              </button>
            ) : (
              <button
                onClick={onStartClick}
                disabled={busy || counts.needed > 0}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-white text-indigo-700 hover:opacity-90 disabled:opacity-50"
              >
                ▶ {hasResult ? "Start again" : "Start test"}
              </button>
            )}
          </div>
        </div>

        {/* status line */}
        <div className="px-6 py-4 text-sm flex flex-wrap gap-x-6 gap-y-2 text-gray-600">
          {locked ? (
            <span className="text-amber-700 font-medium">
              🔒 Test {runInfo.status === "paused" ? "paused" : "in progress"} — the set can't be
              changed until you submit it.
            </span>
          ) : counts.needed > 0 ? (
            <span className="text-amber-700 font-medium">
              Add {counts.needed} more question{counts.needed === 1 ? "" : "s"} to start
              (minimum {limits.MIN_QUESTIONS}).
            </span>
          ) : (
            <span className="text-green-700 font-medium">
              Ready: {counts.available} questions · {formatDuration(setData.totalSeconds)}
            </span>
          )}
          {counts.unavailable > 0 && (
            <span className="text-red-600">
              {counts.unavailable} question{counts.unavailable === 1 ? " is" : "s are"} no longer
              available and won't be used — remove {counts.unavailable === 1 ? "it" : "them"} below.
            </span>
          )}
        </div>
      </section>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-2xl px-5 py-3 text-sm">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-2xl px-5 py-3 text-sm">
          {notice}
        </div>
      )}

      {/* ================= TIMER ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-bold text-gray-900">⏱ Timer</h2>
        <p className="text-sm text-gray-500 mt-1">
          One timer for the whole set. Default is {limits.DEFAULT_SECONDS_PER_QUESTION} seconds per
          question; you can choose {limits.MIN_SECONDS_PER_QUESTION}–{limits.MAX_SECONDS_PER_QUESTION}.
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            type="number"
            min={limits.MIN_SECONDS_PER_QUESTION}
            max={limits.MAX_SECONDS_PER_QUESTION}
            step={1}
            value={timerInput}
            disabled={locked || busy}
            onChange={(e) => setTimerInput(e.target.value)}
            className="w-28 border border-gray-300 rounded-xl px-3 py-2 disabled:bg-gray-50"
          />
          <span className="text-sm text-gray-600">seconds per question</span>

          <button
            onClick={saveTimer}
            disabled={locked || busy || !timerChanged}
            className="px-4 py-2 rounded-xl text-sm font-medium bg-black text-white disabled:opacity-40"
          >
            Save
          </button>
          {setData.secondsPerQuestion !== limits.DEFAULT_SECONDS_PER_QUESTION && (
            <button
              onClick={resetTimer}
              disabled={locked || busy}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 hover:border-black disabled:opacity-40"
            >
              Use default ({limits.DEFAULT_SECONDS_PER_QUESTION}s)
            </button>
          )}

          <span className="text-sm text-gray-500">
            {timerValid
              ? `Total for ${counts.available} question${counts.available === 1 ? "" : "s"}: ${formatDuration(
                  counts.available * timerValue
                )}`
              : `Enter a whole number from ${limits.MIN_SECONDS_PER_QUESTION} to ${limits.MAX_SECONDS_PER_QUESTION}`}
          </span>
        </div>
      </section>

      {/* ================= QUESTIONS IN SET ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <h2 className="font-bold text-gray-900">
            Questions in your set{" "}
            <span className="text-gray-400 font-medium">({counts.total})</span>
          </h2>
          {counts.total > 0 && (
            <button
              onClick={() => setConfirm("clear")}
              disabled={locked || busy}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-red-300 text-red-600 hover:bg-red-50 disabled:opacity-40"
            >
              Clear all
            </button>
          )}
        </div>

        {counts.total === 0 ? (
          <p className="text-sm text-gray-500 mt-4">
            Your set is empty. Add bookmarked questions from the list below.
          </p>
        ) : (
          <ol className="mt-4 divide-y divide-gray-100">
            {setData.questions.map((q, i) => (
              <li key={q.questionId} className="py-3 flex items-start gap-4">
                <span className="w-8 shrink-0 text-sm text-gray-400 tabular-nums pt-0.5">
                  {i + 1}.
                </span>
                <div className="flex-1 min-w-0">
                  {q.available ? (
                    <>
                      <p className="text-xs text-gray-400">
                        {[q.subjectName, q.topicName, q.questionCode].filter(Boolean).join(" · ")}
                      </p>
                      <div
                        className="text-sm text-gray-800 line-clamp-2 prose max-w-none"
                        dangerouslySetInnerHTML={{
                          __html: drawMathInHtml(pickText(q.questionText, lang)),
                        }}
                      />
                    </>
                  ) : (
                    <span className="text-xs font-semibold text-red-700 bg-red-100 px-2 py-1 rounded-lg">
                      No longer available
                    </span>
                  )}
                </div>
                <button
                  onClick={() => removeOne(q.questionId)}
                  disabled={locked || busy}
                  className="shrink-0 px-3 py-1.5 rounded-xl text-xs font-medium border border-gray-300 hover:border-red-400 hover:text-red-600 disabled:opacity-40"
                >
                  Remove
                </button>
              </li>
            ))}
          </ol>
        )}
      </section>

      {/* ================= ADD FROM BOOKMARKS ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm">
        <h2 className="font-bold text-gray-900">
          Add from your bookmarks{" "}
          <span className="text-gray-400 font-medium">({candidates.length} not in set)</span>
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          {room > 0
            ? `You can add up to ${room} more question${room === 1 ? "" : "s"}.`
            : `Your set is full (${limits.MAX_QUESTIONS} questions).`}
        </p>

        {candidates.length === 0 ? (
          <p className="text-sm text-gray-500 mt-4">
            {bookmarks.length === 0
              ? "You haven't bookmarked any questions yet. Open a completed test's Solutions and tap ☆ to save questions."
              : "All your bookmarked questions are already in the set."}
          </p>
        ) : (
          <>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="border border-gray-300 rounded-xl px-3 py-2 text-sm"
              >
                <option value={ALL}>All subjects ({candidates.length})</option>
                {subjects.map((s) => (
                  <option key={s} value={s}>
                    {s} ({candidates.filter((b) => (b.subjectName || "Other") === s).length})
                  </option>
                ))}
              </select>

              <button
                onClick={selectAllShown}
                disabled={locked || busy}
                className="px-3 py-2 rounded-xl text-sm border border-gray-300 hover:border-black disabled:opacity-40"
              >
                Select all shown
              </button>

              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min={1}
                  placeholder="N"
                  value={randomCount}
                  onChange={(e) => setRandomCount(e.target.value)}
                  disabled={locked || busy}
                  className="w-20 border border-gray-300 rounded-xl px-3 py-2 text-sm"
                />
                <button
                  onClick={pickRandom}
                  disabled={locked || busy || !(Number(randomCount) > 0) || room === 0}
                  className="px-3 py-2 rounded-xl text-sm border border-gray-300 hover:border-black disabled:opacity-40"
                >
                  Pick N at random
                </button>
              </div>

              {selectedIds.length > 0 && (
                <button
                  onClick={() => setSelected(new Set())}
                  className="px-3 py-2 rounded-xl text-sm text-gray-500 hover:text-black"
                >
                  Clear selection
                </button>
              )}

              <div className="flex-1" />

              <button
                onClick={addSelected}
                disabled={locked || busy || selectedIds.length === 0 || selectedIds.length > room}
                className="px-5 py-2 rounded-xl text-sm font-semibold bg-indigo-600 text-white disabled:opacity-40"
              >
                Add selected ({selectedIds.length})
              </button>
            </div>

            {selectedIds.length > room && (
              <p className="text-sm text-red-600 mt-2">
                You've selected {selectedIds.length}, but only {room} more can be added.
              </p>
            )}

            <ul className="mt-4 divide-y divide-gray-100">
              {shown.map((b) => {
                const id = String(b.questionId);
                return (
                  <li key={id}>
                    <label className="py-3 flex items-start gap-4 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(id)}
                        disabled={locked || busy}
                        onChange={() => toggleSelect(id)}
                        className="mt-1 w-4 h-4"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs text-gray-400">
                          {[b.subjectName, b.topicName, b.questionCode].filter(Boolean).join(" · ")}
                        </p>
                        <div
                          className="text-sm text-gray-800 line-clamp-2 prose max-w-none"
                          dangerouslySetInnerHTML={{
                            __html: drawMathInHtml(pickText(b.questionText, lang)),
                          }}
                        />
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

export default CustomSetPage;
