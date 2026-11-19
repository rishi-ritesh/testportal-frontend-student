import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  getTestById,
  getNextAttemptInfo,
  getPublishedTests,
  startAttempt,
} from "../../services/test.service";

function InstructionsPage() {
  const { testId } = useParams();
  const navigate = useNavigate();

  const [test, setTest] = useState(null);
  const [nextInfo, setNextInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState("");
  // a completed practice attempt exists → starting again replaces it
  const [hasPracticeResult, setHasPracticeResult] = useState(false);
  const [confirmReplace, setConfirmReplace] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [testData, infoData, tests] = await Promise.all([
          getTestById(testId),
          getNextAttemptInfo(testId).catch(() => null),
          getPublishedTests().catch(() => []),
        ]);
        setTest(testData);
        setNextInfo(infoData);
        const mine = tests.find((t) => String(t.id) === String(testId));
        setHasPracticeResult(mine?.attempt?.practice?.status === "completed");
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load test");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [testId]);

  const handleStart = async () => {
    // a new practice attempt would replace the finished one — ask first
    // (not for the first practice attempt, and not when resuming)
    if (
      nextInfo?.nextType === "practice" &&
      !nextInfo.resuming &&
      hasPracticeResult &&
      !confirmReplace
    ) {
      setConfirmReplace(true);
      return;
    }
    setConfirmReplace(false);
    try {
      setStarting(true);
      const data = await startAttempt(testId);
      navigate(`/attempt/${data.attempt._id}`, { replace: true });
    } catch (err) {
      setError(err.response?.data?.message || "Failed to start attempt");
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return <div className="text-lg font-medium">Loading test...</div>;
  }

  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  const isPractice = nextInfo?.nextType === "practice";

  const banner = !nextInfo
    ? null
    : isPractice
    ? {
        tone: "amber",
        title: nextInfo.resuming
          ? "Resuming your practice attempt"
          : "Practice attempt only",
        text: nextInfo.resuming
          ? "This run is for practice only and won't affect your ranking."
          : "You've already used your ranked attempt. This run is for practice and improvement analysis only — it won't affect your ranking, and it replaces your previous practice attempt.",
      }
    : {
        tone: "blue",
        title: nextInfo.resuming
          ? "Resuming your ranked attempt"
          : "This is your ranked attempt",
        text: nextInfo.resuming
          ? "You'll continue from where you left off. This attempt counts towards your ranking."
          : "Your score on this attempt counts towards your ranking. You get one ranked attempt per test.",
      };

  const toneClasses =
    banner?.tone === "amber"
      ? "bg-amber-50 border-amber-200 text-amber-900"
      : "bg-blue-50 border-blue-200 text-blue-900";

  const totalQuestions = test.sections.reduce(
    (total, section) =>
      total +
      section.subjects.reduce((sum, subject) => sum + subject.questions.length, 0),
    0
  );

  const buttonLabel = starting
    ? "Starting..."
    : isPractice
    ? nextInfo?.resuming
      ? "Resume Practice Test"
      : "Start Practice Test"
    : nextInfo?.resuming
    ? "Resume Test"
    : "Start Test";

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* ================= REPLACE PRACTICE RESULT? ================= */}
      {confirmReplace && (
        <div
          className="fixed inset-0 z-50 bg-gray-900/80 backdrop-blur-sm flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Replace your practice result?"
        >
          <div className="bg-white rounded-3xl p-6 sm:p-10 w-full max-w-sm shadow-xl text-center">
            <div className="text-4xl mb-3">🔁</div>
            <h2 className="text-xl font-bold text-gray-900">Start a new practice attempt?</h2>
            <p className="text-gray-600 mt-3">
              Your previous practice result will be replaced. Your ranked result stays.
            </p>
            <div className="mt-6 space-y-3">
              <button
                onClick={handleStart}
                disabled={starting}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-2xl font-medium disabled:opacity-50"
              >
                {starting ? "Starting..." : "Continue"}
              </button>
              <button
                onClick={() => setConfirmReplace(false)}
                disabled={starting}
                className="w-full border border-gray-300 py-3 rounded-2xl font-medium hover:border-black disabled:opacity-40"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ================= HEADER ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-5 py-5 sm:px-8 sm:py-7">
          <p className="text-blue-100 text-sm font-medium">Mock Test</p>
          <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
            {test.title}
          </h1>
        </div>

        <div className="p-5 sm:p-8">
          {banner && (
            <div className={`rounded-2xl border p-5 ${toneClasses}`}>
              <p className="font-semibold">{banner.title}</p>
              <p className="text-sm mt-1 opacity-90">{banner.text}</p>
            </div>
          )}

          {/* Overview tiles */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-6">
            <div className="bg-gray-50 rounded-2xl p-5">
              <p className="text-sm text-gray-500">Duration</p>
              <h2 className="text-2xl font-bold mt-2 text-blue-700">
                {test.duration} mins
              </h2>
            </div>
            <div className="bg-gray-50 rounded-2xl p-5">
              <p className="text-sm text-gray-500">Sections</p>
              <h2 className="text-2xl font-bold mt-2 text-gray-900">
                {test.sections.length}
              </h2>
            </div>
            <div className="bg-gray-50 rounded-2xl p-5">
              <p className="text-sm text-gray-500">Total Questions</p>
              <h2 className="text-2xl font-bold mt-2 text-gray-900">
                {totalQuestions}
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* ================= INSTRUCTIONS ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 flex items-center gap-3">
          <span className="text-2xl">📋</span>
          <h2 className="text-white text-lg font-bold tracking-wide">
            INSTRUCTIONS
          </h2>
        </div>

        <div className="p-5 sm:p-8">
          <ul className="space-y-4 text-gray-700">
            <li className="flex gap-3">
              <span className="text-blue-600">•</span> Your answers are saved
              automatically, and you can resume where you left off.
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600">•</span> You can switch between
              English and Hindi during the test.
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600">•</span> You can navigate between
              questions and mark them for review anytime.
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600">•</span> Once a section is
              submitted, it cannot be edited again.
            </li>
            <li className="flex gap-3">
              <span className="text-blue-600">•</span> Each section is timed —
              the section auto-submits when its time runs out.
            </li>
          </ul>

          <button
            onClick={handleStart}
            disabled={starting}
            className="mt-8 w-full sm:w-auto bg-blue-600 hover:bg-blue-700 text-white px-8 py-3.5 rounded-2xl font-medium transition disabled:opacity-50"
          >
            {buttonLabel}
          </button>
        </div>
      </section>
    </div>
  );
}

export default InstructionsPage;
