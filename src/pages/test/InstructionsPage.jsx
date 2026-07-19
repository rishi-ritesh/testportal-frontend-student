import { useEffect, useState } from "react";
import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  getTestById,
  getNextAttemptInfo,
  startAttempt,
} from "../../services/test.service";

function InstructionsPage() {
  const { testId } = useParams();

  const navigate = useNavigate();

  const [test, setTest] = useState(null);

  const [nextInfo, setNextInfo] =
    useState(null);

  const [loading, setLoading] =
    useState(true);

  const [starting, setStarting] =
    useState(false);

  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // attempt info is secondary — don't block the page if it fails
        const [testData, infoData] =
          await Promise.all([
            getTestById(testId),
            getNextAttemptInfo(testId).catch(
              () => null
            ),
          ]);

        setTest(testData);
        setNextInfo(infoData);
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to load test"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [testId]);

  const handleStart = async () => {
    try {
      setStarting(true);

      const data = await startAttempt(
        testId
      );

      navigate(
        `/attempt/${data.attempt._id}`
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to start attempt"
      );
    } finally {
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-lg font-medium">
        Loading test...
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 font-medium">
        {error}
      </div>
    );
  }

  // Derive the banner + button copy from what "Start" will actually do.
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

  const buttonLabel = starting
    ? "Starting..."
    : isPractice
    ? nextInfo?.resuming
      ? "Resume Practice Test"
      : "Practice Test"
    : nextInfo?.resuming
    ? "Resume Test"
    : "Start Test";

  return (
    <div className="max-w-4xl mx-auto">
      {/* Header */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm">
        <h1 className="text-3xl font-bold text-gray-900">
          {test.title}
        </h1>

        <p className="text-gray-500 mt-3">
          Read all instructions carefully
          before starting the test.
        </p>

        {/* Ranked / Practice banner */}
        {banner && (
          <div
            className={`mt-6 rounded-2xl border p-5 ${toneClasses}`}
          >
            <p className="font-semibold">{banner.title}</p>
            <p className="text-sm mt-1 opacity-90">
              {banner.text}
            </p>
          </div>
        )}

        {/* Overview */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mt-8">
          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-sm text-gray-500">
              Duration
            </p>

            <h2 className="text-2xl font-bold mt-2">
              {test.duration} mins
            </h2>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-sm text-gray-500">
              Sections
            </p>

            <h2 className="text-2xl font-bold mt-2">
              {test.sections.length}
            </h2>
          </div>

          <div className="bg-gray-50 rounded-2xl p-5">
            <p className="text-sm text-gray-500">
              Total Questions
            </p>

            <h2 className="text-2xl font-bold mt-2">
              {test.sections.reduce(
                (total, section) =>
                  total +
                  section.subjects.reduce(
                    (sum, subject) =>
                      sum +
                      subject.questions.length,
                    0
                  ),
                0
              )}
            </h2>
          </div>
        </div>
      </div>

      {/* Instructions */}
      <div className="bg-white rounded-3xl border border-gray-200 p-8 shadow-sm mt-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-6">
          Instructions
        </h2>

        <ul className="space-y-4 text-gray-700">
          <li>
            • Do not refresh the page during
            the test.
          </li>

          <li>
            • Your answers will be saved
            automatically.
          </li>

          <li>
            • You can navigate between
            questions anytime.
          </li>

          <li>
            • Once a section is submitted,
            it cannot be edited again.
          </li>

          <li>
            • Ensure stable internet
            connection.
          </li>
        </ul>

        {/* Start Button */}
        <button
          onClick={handleStart}
          disabled={starting}
          className="
            mt-8
            bg-black
            text-white
            px-8
            py-3.5
            rounded-2xl
            font-medium
            hover:opacity-90
            transition
            disabled:opacity-50
          "
        >
          {buttonLabel}
        </button>
      </div>
    </div>
  );
}

export default InstructionsPage;