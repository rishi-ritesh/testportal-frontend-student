import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { getPackages } from "../../services/test.service";

const PAGE_SIZE = 10;

function SeriesPage() {
  const navigate = useNavigate();

  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => {
    getPackages()
      .then(setPackages)
      .catch((err) =>
        setError(err.response?.data?.message || "Failed to load test series")
      )
      .finally(() => setLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.type || "").toLowerCase().includes(q)
    );
  }, [packages, search]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageItems = filtered.slice(
    (currentPage - 1) * PAGE_SIZE,
    currentPage * PAGE_SIZE
  );

  if (loading) {
    return <div className="text-lg font-medium">Loading test series...</div>;
  }
  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto">
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        {/* phones: blue title bar, then the search box on its own line
            below it; sm and up: title and search share the blue bar */}
        <div className="sm:bg-gradient-to-r sm:from-blue-800 sm:to-blue-600 sm:px-6 sm:py-5 sm:flex sm:items-center sm:justify-between sm:gap-4">
          <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-4 py-4 sm:bg-none sm:p-0">
            <h1 className="text-white text-base sm:text-lg font-bold tracking-wide flex items-center gap-2 sm:gap-3 whitespace-nowrap">
              <span className="text-xl sm:text-2xl">📝</span>
              ALL TEST SERIES
              <span className="text-sm font-medium bg-white/15 px-3 py-1 rounded-full">
                {packages.length}
              </span>
            </h1>
          </div>
          <div className="px-4 pt-4 pb-1 sm:p-0">
            <input
              placeholder="Search series…"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="min-h-10 rounded-xl px-3 py-2 text-sm outline-none w-full border border-gray-300 bg-gray-50 focus:border-blue-500 focus:bg-white sm:border-0 sm:bg-white sm:w-44 md:w-56"
            />
          </div>
        </div>

        {filtered.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            {packages.length === 0
              ? "No test series available right now."
              : "No series match your search."}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pageItems.map((pkg, i) => (
              <div
                key={pkg._id}
                className="px-4 sm:px-6 py-4 flex items-center justify-between gap-3 sm:gap-4"
              >
                <div className="min-w-0">
                  {/* phones: the full name, wrapped (never cut off) */}
                  <p className="font-semibold text-gray-900 break-words sm:truncate">
                    {(currentPage - 1) * PAGE_SIZE + i + 1}. {pkg.name}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {pkg.type}
                    <span className="text-gray-300"> · </span>
                    {pkg.mockCount} {pkg.mockCount === 1 ? "mock" : "mocks"}
                  </p>
                </div>
                <button
                  onClick={() => navigate(`/packages/${pkg._id}`)}
                  className="shrink-0 min-h-10 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  View Series
                </button>
              </div>
            ))}
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

export default SeriesPage;
