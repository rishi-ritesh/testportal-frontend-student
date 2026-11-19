import MockActions, { MockStatusLabel } from "../MockActions";

function TestCard({ test }) {
    return (
        <div className="bg-white rounded-3xl border border-gray-200 p-6 shadow-sm hover:shadow-md transition">
            {/* Title */}
            <h2 className="text-xl font-semibold text-gray-900">
                {test.title}{" "}
                <MockStatusLabel attempt={test.attempt} />
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

            {/* Start / Resume / View Result + Re-attempt */}
            <div className="mt-6">
                <MockActions testId={test.id} attempt={test.attempt} full />
            </div>
        </div>
    );
}

export default TestCard;