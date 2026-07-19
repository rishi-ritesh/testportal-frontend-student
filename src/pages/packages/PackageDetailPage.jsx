import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { getPackageById } from "../../services/test.service";
import TestCard from "../../components/dashboard/TestCard";

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
        setError(
          err.response?.data?.message || "Failed to load this series"
        );
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
    <div className="space-y-8">
      <div>
        <button
          onClick={() => navigate("/dashboard", { replace: true })}
          className="text-sm text-gray-500 hover:text-gray-900 transition"
        >
          ← Back to Dashboard
        </button>

        <div className="flex items-start justify-between gap-4 mt-3">
          <div>
            <p className="text-sm text-gray-500">{pkg.type}</p>
            <h1 className="text-3xl font-bold text-gray-900 mt-1">
              {pkg.name}
            </h1>
            {pkg.description && (
              <p className="text-gray-500 mt-3 max-w-2xl">
                {pkg.description}
              </p>
            )}
          </div>

          <span className="shrink-0 text-sm font-medium px-4 py-2 rounded-xl bg-gray-100 text-gray-700">
            {pkg.mocks.length} {pkg.mocks.length === 1 ? "mock" : "mocks"}
          </span>
        </div>
      </div>

      {pkg.mocks.length === 0 ? (
        <div className="bg-white border rounded-3xl p-10 text-center text-gray-500">
          No mocks available in this series yet.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {pkg.mocks.map((mock) => (
            <TestCard key={mock.id} test={mock} />
          ))}
        </div>
      )}
    </div>
  );
}

export default PackageDetailPage;
