import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getPackageById } from "../../services/test.service";

function PackageDetailPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [pkg, setPkg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchPackage = async () => {
      try {
        const data = await getPackageById(id);
        setPkg(data);
      } catch (err) {
        setError(err.response?.data?.message || "Failed to load this series");
      } finally {
        setLoading(false);
      }
    };
    fetchPackage();
  }, [id]);

  if (loading) {
    return <div className="text-lg font-medium">Loading series...</div>;
  }

  if (error) {
    return <div className="text-red-600 font-medium">{error}</div>;
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <button
        onClick={() => navigate("/dashboard", { replace: true })}
        className="text-sm text-gray-500 hover:text-gray-900 transition"
      >
        ← Back to Dashboard
      </button>

      {/* ================= SERIES HEADER ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-8 py-7 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-blue-100 text-sm font-medium">{pkg.type}</p>
            <h1 className="text-2xl md:text-3xl font-bold text-white mt-1">
              {pkg.name}
            </h1>
          </div>
          <span className="shrink-0 text-sm font-semibold px-4 py-2 rounded-xl bg-white/15 text-white">
            {pkg.mocks.length} {pkg.mocks.length === 1 ? "mock" : "mocks"}
          </span>
        </div>

        {pkg.description && (
          <p className="text-gray-500 px-8 py-5">{pkg.description}</p>
        )}
      </section>

      {/* ================= MOCKS ================= */}
      <section className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-6 py-5 flex items-center gap-3">
          <span className="text-2xl">📝</span>
          <h2 className="text-white text-lg font-bold tracking-wide">
            MOCK TESTS
          </h2>
        </div>

        {pkg.mocks.length === 0 ? (
          <div className="p-10 text-center text-gray-500">
            No mocks available in this series yet.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {pkg.mocks.map((mock, i) => (
              <div
                key={mock.id}
                className="px-6 py-4 flex items-center justify-between gap-4"
              >
                <div className="min-w-0">
                  <p className="font-semibold text-gray-900 truncate">
                    {i + 1}. {mock.title}
                  </p>
                  <p className="text-sm text-gray-500 mt-1">
                    {mock.totalQuestions} Q
                    <span className="text-gray-300"> · </span>
                    ⏱ {mock.totalDuration} mins
                    <span className="text-gray-300"> · </span>
                    {mock.totalSections}{" "}
                    {mock.totalSections === 1 ? "section" : "sections"}
                  </p>
                </div>

                <button
                  onClick={() => navigate(`/test/${mock.id}/instructions`)}
                  className="shrink-0 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                >
                  Attempt Test
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default PackageDetailPage;
