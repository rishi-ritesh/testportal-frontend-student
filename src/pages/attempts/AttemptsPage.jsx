import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getMyAttempts } from "../../services/test.service";

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
        <div className="bg-gradient-to-r from-green-700 to-green-500 px-6 py-5 flex items-center justify-between gap-4">
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
            className="rounded-xl px-3 py-2 text-sm outline-none w-48 md:w-64 bg-white text-gray-700"
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
                  className="px-6 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {(currentPage - 1) * PAGE_SIZE + i + 1}. {a.testTitle}
                    </p>
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

                  <button
                    onClick={() =>
                      navigate(
                        isCompleted
                          ? `/result/${a.attemptId}`
                          : `/attempt/${a.attemptId}`
                      )
                    }
                    className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium transition text-white ${
                      isCompleted
                        ? "bg-green-600 hover:bg-green-700"
                        : "bg-gray-900 hover:opacity-90"
                    }`}
                  >
                    {isCompleted ? "View Report" : "Resume"}
                  </button>
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
              className="px-4 py-2 rounded-lg text-sm border border-gray-300 disabled:opacity-40 hover:border-black transition"
            >
              ← Prev
            </button>
            <span className="text-sm text-gray-500">
              Page {currentPage} of {totalPages}
            </span>
            <button
              onClick={() => setPage(currentPage + 1)}
              disabled={currentPage >= totalPages}
              className="px-4 py-2 rounded-lg text-sm border border-gray-300 disabled:opacity-40 hover:border-black transition"
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
