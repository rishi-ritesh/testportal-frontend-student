import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";

import {
  getPackages,
  getMyAttempts,
  getBookmarkIds,
} from "../../services/test.service";

const DASHBOARD_LIMIT = 3;

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

function DashboardPage() {
  const navigate = useNavigate();

  const [packages, setPackages] = useState([]);
  const [attempts, setAttempts] = useState([]);
  const [bookmarkCount, setBookmarkCount] = useState(0);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [packageData, attemptData, bookmarkIds] = await Promise.all([
          getPackages(),
          getMyAttempts().catch(() => []),
          getBookmarkIds().catch(() => []),
        ]);
        setPackages(packageData);
        setAttempts(attemptData);
        setBookmarkCount(bookmarkIds.length);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load dashboard");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  if (loading) {
    return <div className="text-lg font-medium">Loading dashboard...</div>;
  }

  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  const visiblePackages = packages.slice(0, DASHBOARD_LIMIT);
  const visibleAttempts = attempts.slice(0, DASHBOARD_LIMIT);

  return (
    <div className="max-w-6xl mx-auto">
      <h1 className="text-3xl md:text-4xl font-bold text-gray-900 text-center mb-8">
        Mock Test Center
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
        {/* ================= AVAILABLE TEST SERIES ================= */}
        <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 flex items-center justify-between">
            <h2 className="text-white text-lg font-bold tracking-wide flex items-center gap-3">
              <span className="text-2xl">📝</span>
              AVAILABLE TEST SERIES
            </h2>
            <span className="text-2xl">🌐</span>
          </div>

          {visiblePackages.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              No test series available right now.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visiblePackages.map((pkg, i) => (
                <div
                  key={pkg._id}
                  className="px-6 py-4 flex items-center justify-between gap-4"
                >
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {i + 1}. {pkg.name}
                    </p>
                    <p className="text-sm text-gray-500 mt-1">
                      {pkg.type}
                      <span className="text-gray-300"> · </span>
                      {pkg.mockCount} {pkg.mockCount === 1 ? "mock" : "mocks"}
                    </p>
                  </div>

                  <button
                    onClick={() => navigate(`/packages/${pkg._id}`)}
                    className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                  >
                    View Series
                  </button>
                </div>
              ))}
            </div>
          )}

          {packages.length > DASHBOARD_LIMIT && (
            <Link
              to="/series"
              className="block px-6 py-4 border-t border-gray-100 text-center text-sm font-medium text-blue-600 hover:bg-blue-50 transition"
            >
              View all {packages.length} series →
            </Link>
          )}
        </section>

        {/* ================= MY ATTEMPTS ================= */}
        <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-gradient-to-r from-green-700 to-green-500 px-6 py-5 flex items-center justify-between">
            <h2 className="text-white text-lg font-bold tracking-wide flex items-center gap-3">
              <span className="text-2xl">🏆</span>
              MY ATTEMPTS
            </h2>
            <span className="text-2xl">⏱️</span>
          </div>

          {visibleAttempts.length === 0 ? (
            <div className="p-10 text-center text-gray-500">
              You haven't attempted any test yet.
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {visibleAttempts.map((a, i) => {
                const isCompleted = a.status === "completed";
                return (
                  <div
                    key={a.attemptId}
                    className="px-6 py-4 flex items-center justify-between gap-4"
                  >
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900 truncate">
                        {i + 1}. {a.testTitle}
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

          {attempts.length > DASHBOARD_LIMIT && (
            <Link
              to="/attempts"
              className="block px-6 py-4 border-t border-gray-100 text-center text-sm font-medium text-green-700 hover:bg-green-50 transition"
            >
              View all {attempts.length} attempts →
            </Link>
          )}
        </section>
      </div>

      {/* ================= BOOKMARKS QUICK ACCESS ================= */}
      <button
        onClick={() => navigate("/bookmarks")}
        className="mt-6 w-full bg-white rounded-3xl border border-gray-200 shadow-sm p-5 flex items-center justify-between gap-4 hover:shadow-md transition text-left"
      >
        <div className="flex items-center gap-4">
          <span className="w-11 h-11 rounded-2xl bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-white text-xl shrink-0">
            🔖
          </span>
          <div>
            <p className="font-semibold text-gray-900">My Bookmarks</p>
            <p className="text-sm text-gray-500">
              {bookmarkCount} saved question{bookmarkCount === 1 ? "" : "s"} for
              revision
            </p>
          </div>
        </div>
        <span className="text-blue-600 font-medium text-sm shrink-0">View →</span>
      </button>
    </div>
  );
}

export default DashboardPage;
