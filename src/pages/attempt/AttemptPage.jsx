import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getAttemptState,
  saveAnswer,
  submitSection,
  pauseAttempt,
  resumeAttempt,
  syncTimer,
} from "../../services/test.service";

// =========================
// HELPERS
// =========================

// Pick the text for the chosen language, falling back to the other one so a
// question is never blank if a translation is missing.
const pickText = (textObj, lang) => {
  if (!textObj) return "";
  return lang === "hi"
    ? textObj.hindi || textObj.english || ""
    : textObj.english || textObj.hindi || "";
};

const formatClock = (totalSeconds) => {
  const s = Math.max(0, totalSeconds);
  const mm = String(Math.floor(s / 60)).padStart(2, "0");
  const ss = String(s % 60).padStart(2, "0");
  return `${mm}:${ss}`;
};

// Background colour from base status (answered / skipped / not_visited).
// "marked for review" is an independent overlay (corner dot), because a
// question can be both answered AND marked.
const paletteBg = (resp, isCurrent) => {
  const base =
    "relative h-12 rounded-xl text-sm font-medium border transition flex items-center justify-center";

  const ring = isCurrent ? " ring-2 ring-offset-2 ring-black" : "";

  if (!resp) {
    return `${base}${ring} bg-white text-gray-700 border-gray-300 hover:border-black`;
  }

  if (resp.selectedOption) {
    return `${base}${ring} bg-green-500 text-white border-green-500`;
  }

  // visited but not answered
  return `${base}${ring} bg-orange-400 text-white border-orange-400`;
};

function AttemptPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [attempt, setAttempt] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  // Position
  const [sectionIndex, setSectionIndex] = useState(0);
  const [questionIndex, setQuestionIndex] = useState(0);

  // responses: { [questionId]: { selectedOption, answerStatus, markedForReview } }
  const [responses, setResponses] = useState({});

  // section timer
  const [secondsLeft, setSecondsLeft] = useState(null);
  const [paused, setPaused] = useState(false);
  const [showLeavePrompt, setShowLeavePrompt] = useState(false);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);

  // question language ("en" | "hi") — remembered across questions & reloads
  const [lang, setLang] = useState(
    () => localStorage.getItem("testLang") || "en"
  );

  const changeLang = (next) => {
    setLang(next);
    localStorage.setItem("testLang", next);
  };
  const durationsRef = useRef([]); // [{ sectionName, durationMinutes }]
  // server-provided remaining seconds for the resumed current section (applied once)
  const resumeRemainingRef = useRef(null); // { index, seconds }
  // latest secondsLeft, readable inside intervals / unload without stale closures
  const secondsLeftRef = useRef(null);

  // time tracking per question (epoch ms)
  const questionStartRef = useRef(Date.now());

  // guards against double auto-submit
  const autoSubmitRef = useRef(false);

  // =========================
  // FETCH ATTEMPT
  // =========================

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        const data = await getAttemptState(attemptId);

        // already finished → straight to result
        if (data.status === "completed") {
          navigate(`/result/${attemptId}`, { replace: true });
          return;
        }

        setAttempt(data);

        // resume at the section AND question the student left off on
        const secIdx = data.currentSectionIndex || 0;
        setSectionIndex(secIdx);

        const secQuestions =
          data.testSnapshot?.sections?.[secIdx]?.questions || [];
        const qIdx = secQuestions.findIndex(
          (q) => String(q.questionId) === String(data.currentQuestionId)
        );
        setQuestionIndex(qIdx >= 0 ? qIdx : 0);

        // restore responses
        const restored = {};
        (data.answers || []).forEach((a) => {
          restored[String(a.questionId)] = {
            selectedOption: a.selectedOption,
            answerStatus: a.answerStatus,
            markedForReview: Boolean(a.markedForReview),
          };
        });
        setResponses(restored);

        durationsRef.current = data.sectionDurations || [];

        // continue the section clock from where the server says it is
        resumeRemainingRef.current = {
          index: data.currentSectionIndex || 0,
          seconds: data.currentSectionRemainingSeconds,
        };
        setPaused(Boolean(data.paused));
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load attempt"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchAttempt();
  }, [attemptId, navigate]);

  // =========================
  // LEAVE GUARDS (back button / tab close)
  // =========================

  // Trap the browser Back button: instead of leaving the test (or landing on
  // the instructions page), re-pin history and show the "pause & go back" card.
  useEffect(() => {
    window.history.pushState(null, "", window.location.href);
    const onPopState = () => {
      window.history.pushState(null, "", window.location.href);
      setShowLeavePrompt(true);
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // Native warning on tab close / refresh so it isn't lost by accident.
  useEffect(() => {
    const onBeforeUnload = (e) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, []);

  // Best-effort save of the timer when the tab is actually closing, so the
  // countdown resumes from exactly here. fetch(keepalive) can carry the auth
  // header and survive unload (sendBeacon can't set Authorization).
  useEffect(() => {
    const persistOnHide = () => {
      const s = secondsLeftRef.current;
      if (s == null) return;
      try {
        const token = localStorage.getItem("token");
        fetch("http://localhost:5000/api/student/attempt/timer", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ attemptId, remainingSeconds: s }),
          keepalive: true,
        });
      } catch {
        /* ignore */
      }
    };
    window.addEventListener("pagehide", persistOnHide);
    return () => window.removeEventListener("pagehide", persistOnHide);
  }, [attemptId]);

  // =========================
  // DERIVED
  // =========================

  const sections = attempt?.testSnapshot?.sections || [];
  const currentSection = sections[sectionIndex];
  const sectionQuestions = currentSection?.questions || [];
  const currentQuestion = sectionQuestions[questionIndex];

  const totalQuestions = useMemo(
    () =>
      sections.reduce(
        (sum, s) => sum + (s.questions?.length || 0),
        0
      ),
    [sections]
  );

  // =========================
  // QUESTION TIMER RESET
  // =========================

  useEffect(() => {
    questionStartRef.current = Date.now();
  }, [sectionIndex, questionIndex]);

  // =========================
  // SECTION COUNTDOWN
  // =========================

  // Initialise the clock for the active section. Uses the server's remaining
  // time for the resumed current section (so reload/resume continues), and a
  // full fresh duration for any section entered afterwards.
  useEffect(() => {
    if (!currentSection) return;

    autoSubmitRef.current = false;

    const meta = durationsRef.current.find(
      (d) => d.sectionName === currentSection.sectionName
    );
    const minutes = meta?.durationMinutes || 0;

    const resume = resumeRemainingRef.current;
    if (resume && resume.index === sectionIndex && resume.seconds != null) {
      setSecondsLeft(resume.seconds);
    } else {
      setSecondsLeft(minutes > 0 ? minutes * 60 : null);
    }
    resumeRemainingRef.current = null;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIndex, currentSection?.sectionName]);

  // Tick every second while running. The interval stays alive across sections —
  // it must NOT clear itself at 0, or the next section's countdown would have no
  // ticker. It clamps at 0 (no-op) and resumes decrementing when the next
  // section seeds a fresh time. Pausing clears it (cleanup); resuming re-creates it.
  useEffect(() => {
    if (paused) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) return 0;
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
  }, [paused]);

  // keep a ref of the latest secondsLeft for intervals / unload handlers
  useEffect(() => {
    secondsLeftRef.current = secondsLeft;
  }, [secondsLeft]);

  // Heartbeat: save the remaining time every 10s while running, so a refresh /
  // power cut / accident resumes from roughly here. The client owns the clock;
  // the server just stores the last reported value.
  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      if (secondsLeftRef.current != null) {
        syncTimer(attemptId, secondsLeftRef.current).catch(() => {});
      }
    }, 10000);
    return () => clearInterval(id);
  }, [paused, attemptId]);

  // auto-submit when section time runs out
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitRef.current && !loading && !paused) {
      autoSubmitRef.current = true;
      handleSubmitSection();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [secondsLeft]);

  // =========================
  // PERSIST CURRENT QUESTION
  // =========================

  const secondsOnQuestion = () =>
    Math.max(0, Math.floor((Date.now() - questionStartRef.current) / 1000));

  // opts: { cleared?: boolean, marked?: boolean }
  const persistCurrent = useCallback(
    async (toQuestionNumber, saveType, opts = {}) => {
      if (!currentQuestion) return;

      const qid = String(currentQuestion.questionId);
      const resp = responses[qid] || {};

      const selectedOption = opts.cleared
        ? null
        : resp.selectedOption ?? null;

      // explicit override wins, otherwise preserve existing marked flag
      const markedForReview =
        opts.marked != null
          ? opts.marked
          : Boolean(resp.markedForReview);

      const answerStatus = selectedOption ? "answered" : "skipped";

      const payload = {
        attemptId,
        questionId: currentQuestion.questionId,
        questionNumber: currentQuestion.questionNumber,
        selectedOption,
        answerStatus,
        markedForReview,
        timeSpent: secondsOnQuestion(),
        fromQuestionNumber: currentQuestion.questionNumber,
        toQuestionNumber,
        saveType,
      };

      await saveAnswer(payload);

      setResponses((prev) => ({
        ...prev,
        [qid]: { selectedOption, answerStatus, markedForReview },
      }));
    },
    [attemptId, currentQuestion, responses]
  );

  // =========================
  // ANSWER SELECTION (local; saved on navigation/submit)
  // =========================

  const selectOption = (key) => {
    if (!currentQuestion) return;
    const qid = String(currentQuestion.questionId);

    setResponses((prev) => ({
      ...prev,
      [qid]: {
        ...prev[qid],
        selectedOption: key,
        answerStatus: "answered",
      },
    }));

    // Persist immediately (no navigation) so an accidental tab close / back
    // still keeps this selection. Position (currentQuestionId) is unchanged.
    saveAnswer({
      attemptId,
      questionId: currentQuestion.questionId,
      questionNumber: currentQuestion.questionNumber,
      selectedOption: key,
      answerStatus: "answered",
      markedForReview: Boolean(responses[qid]?.markedForReview),
      timeSpent: 0, // time is accumulated on navigation, not on select
      fromQuestionNumber: currentQuestion.questionNumber,
      saveType: "answer_select",
    }).catch(() => {});
  };

  // =========================
  // NAVIGATION
  // =========================

  const goToIndex = async (targetIndex, saveType = "direct_navigation") => {
    if (targetIndex === questionIndex) return;
    const target = sectionQuestions[targetIndex];
    try {
      setSaving(true);
      await persistCurrent(target?.questionNumber, saveType);
      setQuestionIndex(targetIndex);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save answer");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNext = async () => {
    const next = questionIndex + 1;
    if (next < sectionQuestions.length) {
      await goToIndex(next, "save_and_next");
    } else {
      try {
        setSaving(true);
        await persistCurrent(undefined, "save_and_next");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to save answer");
      } finally {
        setSaving(false);
      }
    }
  };

  // Toggle "marked for review" on the current question. This button does NOT
  // navigate — moving between questions is done via Save & Next / Previous / the
  // palette.
  const handleToggleMark = async () => {
    if (!currentQuestion) return;
    const qid = String(currentQuestion.questionId);
    const currentlyMarked = Boolean(responses[qid]?.markedForReview);
    try {
      setSaving(true);
      await persistCurrent(undefined, "mark_for_review", {
        marked: !currentlyMarked,
      });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save answer");
    } finally {
      setSaving(false);
    }
  };

  const handleClearResponse = async () => {
    try {
      setSaving(true);
      await persistCurrent(undefined, "clear_response", { cleared: true });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to clear answer");
    } finally {
      setSaving(false);
    }
  };

  // =========================
  // SUBMIT SECTION
  // =========================

  // Actually submits. Manual submits go through the confirmation card
  // (setShowSubmitConfirm); auto-submit on time-out calls this directly.
  async function handleSubmitSection() {
    if (saving) return;
    setShowSubmitConfirm(false);

    try {
      setSaving(true);

      // save whatever is selected on the current question first
      await persistCurrent(undefined, "direct_navigation").catch(() => {});

      const res = await submitSection(attemptId);

      const status = res?.attempt?.status;

      if (status === "completed") {
        navigate(`/result/${attemptId}`, { replace: true });
        return;
      }

      // move to next section
      setSectionIndex((prev) => prev + 1);
      setQuestionIndex(0);
    } catch (err) {
      setError(
        err.response?.data?.message || "Failed to submit section"
      );
    } finally {
      setSaving(false);
    }
  }

  // =========================
  // PAUSE / RESUME
  // =========================

  const handlePause = async () => {
    if (saving || paused) return;
    try {
      setSaving(true);
      // save the current selection/time before freezing the clock
      await persistCurrent(undefined, "direct_navigation").catch(() => {});
      await pauseAttempt(attemptId, secondsLeft);
      setPaused(true);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to pause");
    } finally {
      setSaving(false);
    }
  };

  const handleResume = async () => {
    try {
      setSaving(true);
      const res = await resumeAttempt(attemptId);
      if (res?.currentSectionRemainingSeconds != null) {
        setSecondsLeft(res.currentSectionRemainingSeconds);
      }
      // don't count the paused gap as time on the current question
      questionStartRef.current = Date.now();
      setPaused(false);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to resume");
    } finally {
      setSaving(false);
    }
  };

  // Pause the attempt and leave to the dashboard (never back to instructions).
  const handlePauseAndLeave = async () => {
    try {
      setSaving(true);
      await persistCurrent(undefined, "direct_navigation").catch(() => {});
      if (!paused) await pauseAttempt(attemptId, secondsLeft).catch(() => {});
      navigate("/dashboard");
    } catch (err) {
      setError(err.response?.data?.message || "Failed to leave");
      setSaving(false);
    }
  };

  // =========================
  // RENDER STATES
  // =========================

  if (loading) {
    return (
      <div className="text-lg font-medium">Loading attempt...</div>
    );
  }

  if (error && !currentQuestion) {
    return (
      <div className="text-red-600 font-medium">{error}</div>
    );
  }

  if (!currentQuestion) {
    return <div>No questions found.</div>;
  }

  const currentResp = responses[String(currentQuestion.questionId)];
  const selectedKey = currentResp?.selectedOption;
  const isMarked = Boolean(currentResp?.markedForReview);

  const isLastSection = sectionIndex === sections.length - 1;

  const sectionAnswered = sectionQuestions.filter(
    (q) => responses[String(q.questionId)]?.selectedOption
  ).length;
  const sectionMarked = sectionQuestions.filter(
    (q) => responses[String(q.questionId)]?.markedForReview
  ).length;

  return (
    <>
      {/* ========================= */}
      {/* FIXED TOP BAR */}
      {/* ========================= */}

      <div className="fixed top-0 inset-x-0 z-40 bg-white border-b border-gray-200 shadow-sm">
        <div className="px-6 h-16 flex items-center justify-between">
          <div className="min-w-0">
            <p className="text-sm font-semibold text-gray-900 truncate">
              {currentSection?.sectionName}
            </p>
            <p className="text-xs text-gray-400">
              Section {sectionIndex + 1} / {sections.length}
              {attempt?.attemptType && (
                <>
                  {" · "}
                  {attempt.attemptType === "ranked" ? "Ranked" : "Practice"}
                </>
              )}
            </p>
          </div>

          <div className="flex items-center gap-3">
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

            {/* Countdown */}
            {secondsLeft !== null && (
              <div
                className={`px-4 py-2 rounded-xl text-sm font-semibold tabular-nums ${
                  secondsLeft <= 60
                    ? "bg-red-100 text-red-700"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                ⏱ {formatClock(secondsLeft)}
              </div>
            )}

            {/* Pause */}
            <button
              onClick={handlePause}
              disabled={saving || paused}
              className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-300 hover:border-black disabled:opacity-40"
            >
              ⏸ Pause
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-12 gap-6 pt-16">
      {/* ========================= */}
      {/* LEAVE PROMPT (back button) */}
      {/* ========================= */}

      {showLeavePrompt && !paused && (
        <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm mx-4 shadow-xl">
            <div className="text-4xl mb-3">⏸</div>
            <h2 className="text-2xl font-bold text-gray-900">Leave the test?</h2>
            <p className="text-gray-500 mt-2">
              Your progress is saved. You can pause and come back later — you'll
              resume from exactly where you left off.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={handlePauseAndLeave}
                disabled={saving}
                className="w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
              >
                Pause &amp; go back
              </button>
              <button
                onClick={() => setShowLeavePrompt(false)}
                disabled={saving}
                className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
              >
                Stay in test
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* PAUSED OVERLAY */}
      {/* ========================= */}

      {paused && (
        <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 text-center max-w-sm mx-4 shadow-xl">
            <div className="text-4xl mb-3">⏸</div>
            <h2 className="text-2xl font-bold text-gray-900">Test paused</h2>
            <p className="text-gray-500 mt-2">
              Your timer is frozen. The test stays hidden until you resume.
            </p>
            {secondsLeft !== null && (
              <p className="text-gray-800 font-semibold mt-4 tabular-nums">
                Time left in this section: {formatClock(secondsLeft)}
              </p>
            )}
            <button
              onClick={handleResume}
              disabled={saving}
              className="mt-6 w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
            >
              ▶ Resume test
            </button>
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* SUBMIT CONFIRMATION CARD */}
      {/* ========================= */}

      {showSubmitConfirm && (
        <div className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center">
          <div className="bg-white rounded-3xl p-10 max-w-sm mx-4 shadow-xl text-center">
            <div className="text-4xl mb-3">{isLastSection ? "🏁" : "📤"}</div>
            <h2 className="text-2xl font-bold text-gray-900">
              {isLastSection ? "Finish the test?" : "Submit this section?"}
            </h2>

            {/* Section summary */}
            <div className="mt-5 grid grid-cols-3 gap-3 text-center">
              <div className="rounded-2xl bg-gray-50 p-3">
                <p className="text-lg font-bold text-gray-900">{sectionQuestions.length}</p>
                <p className="text-xs text-gray-500">Questions</p>
              </div>
              <div className="rounded-2xl bg-green-50 p-3">
                <p className="text-lg font-bold text-green-700">{sectionAnswered}</p>
                <p className="text-xs text-gray-500">Answered</p>
              </div>
              <div className="rounded-2xl bg-purple-50 p-3">
                <p className="text-lg font-bold text-purple-700">{sectionMarked}</p>
                <p className="text-xs text-gray-500">Marked</p>
              </div>
            </div>

            <p className="text-gray-500 mt-5 text-sm">
              {isLastSection
                ? "This ends the test and generates your result. You can't come back to it."
                : "You won't be able to return to this section once submitted."}
            </p>

            <div className="mt-6 space-y-3">
              <button
                onClick={handleSubmitSection}
                disabled={saving}
                className="w-full bg-green-600 text-white py-3 rounded-2xl font-medium hover:opacity-90 disabled:opacity-40"
              >
                {saving
                  ? "Submitting..."
                  : isLastSection
                  ? "Submit & finish test"
                  : "Submit section"}
              </button>
              <button
                onClick={() => setShowSubmitConfirm(false)}
                disabled={saving}
                className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
              >
                Go back
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* QUESTION AREA */}
      {/* ========================= */}

      <div className="col-span-9">
        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
          {/* Header */}
          <div className="mb-6">
            <p className="text-sm text-gray-500">
              {currentSection.sectionName}
              <span className="text-gray-300"> · </span>
              {currentQuestion.subjectName}
              {attempt?.attemptType && (
                <>
                  <span className="text-gray-300"> · </span>
                  {attempt.attemptType === "ranked"
                    ? "Ranked Attempt"
                    : "Practice (not ranked)"}
                </>
              )}
            </p>

            <h2 className="text-xl font-bold text-gray-900 mt-1">
              Question {currentQuestion.sectionQuestionNumber}
              <span className="text-gray-400 text-base font-medium">
                {" "}
                / {sectionQuestions.length}
              </span>
              {isMarked && (
                <span className="ml-3 align-middle text-xs font-semibold text-purple-700 bg-purple-100 px-2 py-1 rounded-lg">
                  Marked
                </span>
              )}
            </h2>
          </div>

          {/* Question */}
          <div
            className="text-gray-900 leading-7 prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: pickText(currentQuestion.question, lang),
            }}
          />

          {/* Options */}
          <div className="mt-8 space-y-4">
            {currentQuestion.options.map((option) => {
              const active = selectedKey === option.key;
              return (
                <button
                  key={option.key}
                  onClick={() => selectOption(option.key)}
                  className={`w-full text-left border rounded-2xl p-4 transition ${
                    active
                      ? "border-black bg-gray-50"
                      : "border-gray-200 hover:border-black"
                  }`}
                >
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-8 h-8 rounded-full border flex items-center justify-center font-medium shrink-0 ${
                        active
                          ? "bg-black text-white border-black"
                          : "border-gray-300"
                      }`}
                    >
                      {option.key}
                    </div>

                    <div
                      className="prose max-w-none"
                      dangerouslySetInnerHTML={{
                        __html: pickText(option.text, lang),
                      }}
                    />
                  </div>
                </button>
              );
            })}
          </div>

          {/* Action row */}
          <div className="flex flex-wrap items-center gap-3 mt-10">
            <button
              onClick={handleClearResponse}
              disabled={saving || !selectedKey}
              className="px-5 py-3 rounded-2xl border border-gray-300 disabled:opacity-40"
            >
              Clear
            </button>

            <button
              onClick={handleToggleMark}
              disabled={saving}
              className={`px-5 py-3 rounded-2xl border disabled:opacity-40 ${
                isMarked
                  ? "border-purple-500 bg-purple-100 text-purple-800"
                  : "border-purple-400 text-purple-700"
              }`}
            >
              {isMarked ? "Unmark for Review" : "Mark for Review"}
            </button>

            <div className="flex-1" />

            <button
              disabled={saving || questionIndex === 0}
              onClick={() => goToIndex(questionIndex - 1)}
              className="px-6 py-3 rounded-2xl border border-gray-300 disabled:opacity-40"
            >
              Previous
            </button>

            {questionIndex < sectionQuestions.length - 1 ? (
              <button
                disabled={saving}
                onClick={handleSaveNext}
                className="px-6 py-3 rounded-2xl bg-black text-white disabled:opacity-40"
              >
                Next
              </button>
            ) : (
              <button
                disabled={saving}
                onClick={() => setShowSubmitConfirm(true)}
                className="px-6 py-3 rounded-2xl bg-green-600 text-white disabled:opacity-40"
              >
                {isLastSection ? "Submit Test" : "Submit Section"}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ========================= */}
      {/* QUESTION PALETTE */}
      {/* ========================= */}

      <div className="col-span-3">
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm sticky top-20">
          <div className="flex items-center justify-between mb-1">
            <h3 className="text-lg font-bold">
              Section {sectionIndex + 1}
              <span className="text-gray-400 font-medium">
                {" "}
                / {sections.length}
              </span>
            </h3>
            <span className="text-xs text-gray-400">
              {totalQuestions} total
            </span>
          </div>

          <p className="text-xs text-gray-400 mb-5">
            {currentSection.sectionName}
          </p>

          <div className="grid grid-cols-4 gap-3">
            {sectionQuestions.map((q, index) => {
              const resp = responses[String(q.questionId)];
              return (
                <button
                  key={q.questionId}
                  onClick={() => goToIndex(index)}
                  disabled={saving}
                  className={paletteBg(resp, index === questionIndex)}
                >
                  {q.sectionQuestionNumber}
                  {resp?.markedForReview && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 rounded-full bg-purple-600 border-2 border-white" />
                  )}
                </button>
              );
            })}
          </div>

          {/* Legend */}
          <div className="mt-6 space-y-2 text-xs text-gray-600">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-green-500" /> Answered
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded bg-orange-400" /> Skipped
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-purple-600" /> Marked
              for review
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded border border-gray-300 bg-white" />{" "}
              Not visited
            </div>
          </div>

          <button
            onClick={() => setShowSubmitConfirm(true)}
            disabled={saving}
            className="w-full mt-6 px-4 py-3 rounded-2xl bg-green-600 text-white font-medium disabled:opacity-40"
          >
            {isLastSection ? "Submit Test" : "Submit Section"}
          </button>
        </div>
      </div>
      </div>
    </>
  );
}

export default AttemptPage;
