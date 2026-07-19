import { useNavigate } from "react-router-dom";

function TestCard({ test }) {
    const navigate = useNavigate();
    return (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
            {/* Title */}
            <h2 className="text-xl font-semibold text-gray-900">
                {test.title}
            </h2>

            {/* Info */}
            <div className="mt-5 space-y-2 text-sm text-gray-600">
                <p>
                    Sections:{" "}
                    <span className="font-medium text-gray-900">
                        {test.totalSections}
                    </span>
                </p>

                <p>
                    Questions:{" "}
                    <span className="font-medium text-gray-900">
                        {test.totalQuestions}
                    </span>
                </p>

                <p>
                    Duration:{" "}
                    <span className="font-medium text-gray-900">
                        {test.totalDuration} mins
                    </span>
                </p>
            </div>

            {/* Button */}
            <button
                onClick={() =>
                    navigate(
                        `/test/${test.id}/instructions`
                    )
                }
                className="
          mt-6
          w-full
          bg-black
          text-white
          py-3
          rounded-2xl
          font-medium
          hover:opacity-90
          transition
        "
            >
                Start Test
            </button>
        </div>
    );
}

export default TestCard;