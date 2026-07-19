import { useNavigate } from "react-router-dom";

function PackageCard({ pkg }) {
  const navigate = useNavigate();

  return (
    <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <h2 className="text-xl font-semibold text-gray-900">
          {pkg.name}
        </h2>
        <span className="shrink-0 text-xs font-medium px-3 py-1 rounded-full bg-gray-100 text-gray-700">
          {pkg.type}
        </span>
      </div>

      {pkg.description && (
        <p className="mt-3 text-sm text-gray-500 line-clamp-3">
          {pkg.description}
        </p>
      )}

      <p className="mt-4 text-sm text-gray-600">
        <span className="font-medium text-gray-900">
          {pkg.mockCount}
        </span>{" "}
        {pkg.mockCount === 1 ? "mock" : "mocks"}
      </p>

      <button
        onClick={() => navigate(`/packages/${pkg._id}`)}
        className="mt-6 w-full bg-black text-white py-3 rounded-2xl font-medium hover:opacity-90 transition"
      >
        View Series
      </button>
    </div>
  );
}

export default PackageCard;
