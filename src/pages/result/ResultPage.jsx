import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getMyAttempts, getResult } from "../../services/test.service";
import { instructionsPath } from "../../lib/attemptActions";
import SolutionsPanel from "./SolutionsPanel";

// =========================
// HELPERS
// =========================

const formatTime = (seconds) => {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return m > 0 ? `${m}m ${r}s` : `${r}s`;
};

const Stat = ({ label, value, accent }) => (
  <div className="bg-gray-50 rounded-2xl p-4 sm:p-5 min-w-0">
    <p className="text-sm text-gray-500">{label}</p>
    <h2
      className={`text-xl sm:text-2xl font-bold mt-2 break-words ${accent || "text-gray-900"}`}
    >
      {value}
    </h2>
  </div>
);

const formatDelta = (d, suffix = "") => {
  if (d == null) return "";
  const sign = d > 0 ? "+" : "";
  return `${sign}${d}${suffix}`;
};

const ImprovementStat = ({ label, first, now, delta, suffix }) => {
  const color =
    delta > 0
      ? "text-green-600"
      : delta < 0
      ? "text-red-600"
      : "text-gray-500";

  return (
    <div className="bg-gray-50 rounded-2xl p-4 sm:p-5">
      <p className="text-sm text-gray-500">{label}</p>
      <div className="flex flex-wrap items-baseline gap-2 mt-2">
        <span className="text-gray-400 text-sm">{first}</span>
        <span className="text-gray-300">→</span>
        <span className="text-2xl font-bold text-gray-900">{now}</span>
      </div>
      <p className={`mt-1 text-sm font-medium ${color}`}>
        {delta === 0
          ? "No change"
          : `${formatDelta(delta, suffix)} vs first`}
      </p>
    </div>
  );
};

function ResultPage() {
  const { attemptId } = useParams();
  const navigate = useNavigate();

  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [tab, setTab] = useState("analysis");
  // the test this result belongs to (for "Re-attempt this test")
  const [testId, setTestId] = useState(null);

  useEffect(() => {
    const fetchResult = async () => {
      try {
        const data = await getResult(attemptId);
        setResult(data);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load result"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchResult();
  }, [attemptId]);

  useEffect(() => {
    getMyAttempts()
      .then((list) => {
        const mine = list.find((a) => String(a.attemptId) === String(attemptId));
        setTestId(mine?.testId || null);
      })
      .catch(() => {});
  }, [attemptId]);

  if (loading) {
    return <div className="text-lg font-medium">Loading result...</div>;
  }

  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  const comp = result.competitionStats || {};

  return (
    <div className="max-w-5xl mx-auto space-y-4 sm:space-y-6">
      {/* ========================= */}
      {/* HEADLINE */}
      {/* ========================= */}

      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-green-700 to-green-500 px-5 py-5 sm:px-8 sm:py-7 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
          <div className="min-w-0">
            <p className="text-green-100 text-sm font-medium">
              Test completed
              {result.attemptType &&
                (result.attemptType === "ranked"
                  ? " · First Attempt (Ranked)"
                  : " · Practice Attempt")}
            </p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
              Your Result
            </h1>
          </div>

          <div className="flex flex-wrap gap-2 shrink-0 self-start">
            <button
              onClick={() => navigate("/dashboard")}
              className="min-h-10 bg-white/15 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-white/25 transition"
            >
              ← Back to Dashboard
            </button>
            {result.status === "completed" && testId && (
              <button
                onClick={() => navigate(instructionsPath(testId))}
                className="min-h-10 bg-white text-green-800 px-4 py-2 rounded-xl text-sm font-semibold hover:opacity-90 transition"
              >
                Re-attempt this test
              </button>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5 p-4 sm:p-8">
          <Stat label="Score" value={result.score} />
          <Stat
            label="Accuracy"
            value={`${result.accuracy}%`}
            accent="text-blue-600"
          />
          <Stat
            label="Rank"
            value={comp.rank ?? "—"}
            accent="text-purple-600"
          />
          <Stat
            label="Percentile"
            value={
              comp.percentile != null ? `${comp.percentile}` : "—"
            }
            accent="text-green-600"
          />
        </div>
      </section>

      {/* ========================= */}
      {/* TABS */}
      {/* ========================= */}

      <div className="flex flex-wrap gap-2" role="tablist">
        {[
          { key: "analysis", label: "Analysis" },
          { key: "solutions", label: "Solutions" },
        ].map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            role="tab"
            aria-selected={tab === t.key}
            className={`min-h-11 px-5 py-2.5 rounded-2xl text-sm font-medium border transition ${
              tab === t.key
                ? "bg-blue-600 text-white border-blue-600"
                : "border-gray-300 text-gray-700 hover:border-black"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "solutions" ? (
        <SolutionsPanel questions={result.questionAnalysis || []} />
      ) : (
      <>

      {/* ========================= */}
      {/* IMPROVEMENT (practice only) */}
      {/* ========================= */}

      {result.improvement && (
        <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-2">
            Improvement vs First Attempt
          </h2>
          <p className="text-gray-500 text-sm mb-6">
            This practice attempt is not ranked — here's how it compares
            to your first (ranked) attempt.
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-5">
            <ImprovementStat
              label="Score"
              first={result.improvement.rankedScore}
              now={result.score}
              delta={result.improvement.scoreDelta}
            />
            <ImprovementStat
              label="Accuracy"
              first={`${result.improvement.rankedAccuracy}%`}
              now={`${result.accuracy}%`}
              delta={result.improvement.accuracyDelta}
              suffix="%"
            />
            <ImprovementStat
              label="Correct"
              first={result.improvement.rankedCorrect}
              now={result.correct}
              delta={result.improvement.correctDelta}
            />
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* BREAKDOWN */}
      {/* ========================= */}

      <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 shadow-sm">
        <h2 className="text-xl font-bold mb-4 sm:mb-6">Overview</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          <Stat
            label="Correct"
            value={result.correct}
            accent="text-green-600"
          />
          <Stat
            label="Wrong"
            value={result.wrong}
            accent="text-red-600"
          />
          <Stat label="Attempted" value={result.attempted} />
          <Stat
            label="Skipped"
            value={result.skipped + result.notVisited}
          />
          <Stat label="Total Questions" value={result.totalQuestions} />
          <Stat
            label="Marked for Review"
            value={result.markedForReview}
          />
          <Stat
            label="Time Spent"
            value={formatTime(result.totalTimeSpent)}
          />
        </div>
      </div>

      {/* ========================= */}
      {/* COMPETITION */}
      {/* ========================= */}

      <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 shadow-sm">
        <h2 className="text-xl font-bold mb-4 sm:mb-6">How You Compare</h2>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          <Stat
            label="Participants"
            value={comp.totalParticipants ?? 0}
          />
          <Stat label="Topper Score" value={comp.topperScore ?? 0} />
          <Stat
            label="Avg Score"
            value={comp.averageScore ?? 0}
          />
          <Stat
            label="Avg Accuracy"
            value={`${comp.averageAccuracy ?? 0}%`}
          />
        </div>
      </div>

      {/* ========================= */}
      {/* SUBJECT-WISE */}
      {/* ========================= */}

      {result.subjects?.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4 sm:mb-6">Subject-wise</h2>

          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 pr-4">Subject</th>
                <th className="py-3 px-4">Score</th>
                <th className="py-3 px-4">Correct</th>
                <th className="py-3 px-4">Wrong</th>
                <th className="py-3 px-4">Accuracy</th>
                <th className="py-3 px-4">Avg Time</th>
              </tr>
            </thead>
            <tbody>
              {result.subjects.map((s) => (
                <tr
                  key={s.subjectName}
                  className="border-b border-gray-100"
                >
                  <td className="py-3 pr-4 font-medium">
                    {s.subjectName}
                  </td>
                  <td className="py-3 px-4">{s.score}</td>
                  <td className="py-3 px-4 text-green-600">
                    {s.correct}
                  </td>
                  <td className="py-3 px-4 text-red-600">{s.wrong}</td>
                  <td className="py-3 px-4">{s.accuracy}%</td>
                  <td className="py-3 px-4">
                    {formatTime(s.avgTimeSpent)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      {/* ========================= */}
      {/* TOPIC-WISE */}
      {/* ========================= */}

      {result.topics?.length > 0 && (
        <div className="bg-white rounded-3xl border border-gray-200 p-5 sm:p-8 shadow-sm">
          <h2 className="text-xl font-bold mb-4 sm:mb-6">Topic-wise</h2>

          <div className="overflow-x-auto -mx-5 px-5 sm:mx-0 sm:px-0">
          <table className="w-full text-sm whitespace-nowrap">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-200">
                <th className="py-3 pr-4">Topic</th>
                <th className="py-3 px-4">Subject</th>
                <th className="py-3 px-4">Correct</th>
                <th className="py-3 px-4">Wrong</th>
                <th className="py-3 px-4">Accuracy</th>
              </tr>
            </thead>
            <tbody>
              {result.topics.map((t) => (
                <tr
                  key={`${t.subjectName}-${t.topicName}`}
                  className="border-b border-gray-100"
                >
                  <td className="py-3 pr-4 font-medium">
                    {t.topicName}
                  </td>
                  <td className="py-3 px-4 text-gray-500">
                    {t.subjectName}
                  </td>
                  <td className="py-3 px-4 text-green-600">
                    {t.correct}
                  </td>
                  <td className="py-3 px-4 text-red-600">{t.wrong}</td>
                  <td className="py-3 px-4">{t.accuracy}%</td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        </div>
      )}

      </>
      )}
    </div>
  );
}

export default ResultPage;
