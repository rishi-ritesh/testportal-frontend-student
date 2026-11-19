import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getMyAttempts } from "../../services/test.service";
import {
  instructionsPath,
  testsWithOpenPractice,
} from "../../lib/attemptActions";
import AttemptTypeBadge from "../../components/AttemptTypeBadge";

const PAGE_SIZE = 10;

const formatDate = (value) => {
  if (!value) return "—";
  try {
    return new Date(value).toLocaleDateString(undefined, {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
};

const STATUS_STYLES = {
  completed: "text-green-600",
  in_progress: "text-amber-600",
  paused: "text-gray-500",
};

const STATUS_LABEL = {
  completed: "Completed",
  in_progress: "In progress",
  paused: "Paused",
};

function AttemptsPage() {
  const navigate = useNavigate();

  const [attempts, setAttempts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [seriesFilter, setSeriesFilter] = useState("all");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getMyAttempts()
      .then(setAttempts)
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load attempts")
      )
      .finally(() => setLoading(false));
  }, []);

  // unique series names across the student's attempts, for the filter dropdown
  const seriesOptions = useMemo(() => {
    const set = new Set();
    attempts.forEach((a) => (a.seriesNames || []).forEach((s) => set.add(s)));
    return Array.from(set).sort();
  }, [attempts]);

  const filtered = useMemo(() => {
    if (seriesFilter === "all") return attempts;
    return attempts.filter((a) =>
      (a.seriesNames || []).includes(seriesFilter)
    );
  }, [attempts, seriesFilter]);

  // from ALL attempts (not just this page / filter)
  const openPractice = useMemo(() => testsWithOpenPractice(attempts), [attempts]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  if (loading) {
    return <div className="text-lg font-medium">Loading attempts...</div>;
  }
  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-green-700 to-green-500 px-4 py-4 sm:px-6 sm:py-5 flex flex-wrap items-center justify-between gap-3 sm:gap-4">
          <h1 className="text-white text-lg font-bold tracking-wide flex items-center gap-3">
            <span className="text-2xl">🏆</span>
            MY ATTEMPTS
            <span className="text-sm font-medium bg-white/15 px-3 py-1 rounded-full">
              {attempts.length}
            </span>
          </h1>
          <select
            value={seriesFilter}
            onChange={(e) => {
              setSeriesFilter(e.target.value);
              setPage(1);
            }}
            className="min-h-10 max-w-full rounded-xl px-3 py-2 text-sm outline-none w-full sm:w-48 md:w-64 bg-white text-gray-700"
          >
            <option value="all">All test series</option>
            {seriesOptions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            {attempts.length === 0
              ? "You haven't attempted any test yet."
              : "No attempts in this test series."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageItems.map((a, i) => {
              const isCompleted = a.status === "completed";
              return (
                <div
                  key={a.attemptId}
                  className="px-4 sm:px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4"
                >
                  <div className="min-w-0 w-full sm:w-auto">
                    <div className="flex items-start gap-2 min-w-0">
                      <p className="font-semibold text-gray-900 min-w-0 line-clamp-2 sm:truncate">
                        {(currentPage - 1) * PAGE_SIZE + i + 1}. {a.testTitle}
                      </p>
                      <AttemptTypeBadge type={a.attemptType} />
                    </div>
                    {a.seriesNames?.length > 0 && (
                      <p className="text-xs text-gray-400 mt-0.5 truncate">
                        {a.seriesNames.join(", ")}
                      </p>
                    )}
                    <div className="mt-1 flex flex-wrap gap-x-5 gap-y-1 text-sm text-gray-500">
                      <span>Date: {formatDate(a.updatedAt || a.startedAt)}</span>
                      {isCompleted && <span>Score: {a.finalScore}</span>}
                      {isCompleted && <span>Accuracy: {a.accuracy}%</span>}
                      <span>
                        Status:{" "}
                        <span
                          className={`font-medium ${
                            STATUS_STYLES[a.status] || "text-gray-600"
                          }`}
                        >
                          {STATUS_LABEL[a.status] || a.status}
                        </span>
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2 w-full sm:w-auto shrink-0">
                    <button
                      onClick={() =>
                        navigate(
                          isCompleted
                            ? `/result/${a.attemptId}`
                            : `/attempt/${a.attemptId}`
                        )
                      }
                      className={`flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition text-white ${
                        isCompleted
                          ? "bg-green-600 hover:bg-green-700"
                          : "bg-gray-900 hover:opacity-90"
                      }`}
                    >
                      {isCompleted ? "View Report" : "Resume"}
                    </button>
                    {/* hidden while this test has a practice attempt open (its row shows Resume) */}
                    {isCompleted && a.testId && !openPractice.has(String(a.testId)) && (
                      <button
                        onClick={() => navigate(instructionsPath(a.testId))}
                        className="flex-1 sm:flex-none min-h-10 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border border-green-600 text-green-700 hover:bg-green-50 transition"
                      >
                        Re-attempt
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-4 px-6 py-4 border-t border-gray-100">
            <button
              onClick={() => setPage(currentPage - 1)}
              disabled={currentPage <= 1}
              className="min-h-10 px-4 py-2 rounded-lg text-sm border border-gray-300 disabled:opacity-40 hover:border-black transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="min-h-10 px-4 py-2 rounded-lg text-sm border border-gray-300 disabled:opacity-40 hover:border-black transition"
            >
              Next →
            </button>
          </div>
        )}
      </section>
    </div>
  );
}

export default AttemptsPage;
