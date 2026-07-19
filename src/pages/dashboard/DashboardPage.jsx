import { useEffect, useState } from "react";

import {
  getPackages,
  getMyAttempts,
} from "../../services/test.service";

import PackageCard from "../../components/packages/PackageCard";
import AttemptCard from "../../components/dashboard/AttemptCard";

function DashboardPage() {
  const [packages, setPackages] = useState([]);
  const [attempts, setAttempts] = useState([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        // attempts are secondary — don't fail the page if they error
        const [packageData, attemptData] = await Promise.all([
          getPackages(),
          getMyAttempts().catch(() => []),
        ]);

        setPackages(packageData);
        setAttempts(attemptData);
      } catch (err) {
        setError(
          err.response?.data?.message || "Failed to load test series"
        );
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="text-lg font-medium">Loading test series...</div>
    );
  }

  if (error) {
    return (
      <div className="text-red-600 font-medium">{error}</div>
    );
  }

  return (
    <div className="space-y-12">
      {/* ========================= */}
      {/* YOUR ATTEMPTS */}
      {/* ========================= */}

      {attempts.length > 0 && (
        <section>
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900">
              Your Attempts
            </h1>
            <p className="text-gray-500 mt-2">
              Resume a test or review your past results
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {attempts.map((attempt) => (
              <AttemptCard
                key={attempt.attemptId}
                attempt={attempt}
              />
            ))}
          </div>
        </section>
      )}

      {/* ========================= */}
      {/* AVAILABLE TEST SERIES */}
      {/* ========================= */}

      <section>
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-gray-900">
            Available Test Series
          </h1>
          <p className="text-gray-500 mt-2">
            Start practicing and track your performance
          </p>
        </div>

        {packages.length === 0 ? (
          <div className="bg-white border rounded-3xl p-10 text-center text-gray-500">
            No test series available right now.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {packages.map((pkg) => (
              <PackageCard key={pkg._id} pkg={pkg} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export default DashboardPage;
