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
} from "../../services/test.service";

// =========================
// HELPERS
// =========================

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
  const durationsRef = useRef([]); // [{ sectionName, durationMinutes }]

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
        setSectionIndex(data.currentSectionIndex || 0);
        setQuestionIndex(0);

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

  useEffect(() => {
    if (!currentSection) return;

    autoSubmitRef.current = false;

    const meta = durationsRef.current.find(
      (d) => d.sectionName === currentSection.sectionName
    );

    const minutes = meta?.durationMinutes || 0;

    // 0 / missing duration → no enforced timer
    setSecondsLeft(minutes > 0 ? minutes * 60 : null);

    if (!minutes) return;

    const id = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev === null) return prev;
        if (prev <= 1) {
          clearInterval(id);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionIndex, attempt]);

  // auto-submit when section time runs out
  useEffect(() => {
    if (secondsLeft === 0 && !autoSubmitRef.current && !loading) {
      autoSubmitRef.current = true;
      handleSubmitSection(true);
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

  const handleMarkForReview = async () => {
    const next = questionIndex + 1;
    const target = sectionQuestions[next];
    try {
      setSaving(true);
      // keep any selected answer; just set the marked flag
      await persistCurrent(target?.questionNumber, "mark_for_review", {
        marked: true,
      });
      if (target) setQuestionIndex(next);
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

  async function handleSubmitSection(auto = false) {
    if (saving) return;

    const isLast = sectionIndex === sections.length - 1;

    if (!auto) {
      const msg = isLast
        ? "Submit the final section and finish the test? This cannot be undone."
        : "Submit this section? You will not be able to return to it.";
      if (!window.confirm(msg)) return;
    }

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

  return (
    <div className="grid grid-cols-12 gap-6">
      {/* ========================= */}
      {/* QUESTION AREA */}
      {/* ========================= */}

      <div className="col-span-9">
        {error && (
          <div className="mb-4 text-sm text-red-600">{error}</div>
        )}

        <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div>
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

            {/* Section timer */}
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
          </div>

          {/* Question */}
          <div
            className="text-gray-900 leading-7 prose max-w-none"
            dangerouslySetInnerHTML={{
              __html: currentQuestion.question?.english || "",
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
                        __html: option.text?.english || "",
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
              onClick={handleMarkForReview}
              disabled={saving}
              className="px-5 py-3 rounded-2xl border border-purple-400 text-purple-700 disabled:opacity-40"
            >
              Mark for Review &amp; Next
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
                Save &amp; Next
              </button>
            ) : (
              <button
                disabled={saving}
                onClick={() => handleSubmitSection(false)}
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
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm sticky top-6">
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
            onClick={() => handleSubmitSection(false)}
            disabled={saving}
            className="w-full mt-6 px-4 py-3 rounded-2xl bg-green-600 text-white font-medium disabled:opacity-40"
          >
            {isLastSection ? "Submit Test" : "Submit Section"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default AttemptPage;
