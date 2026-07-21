import { Link } from "react-router-dom";

function NotFoundPage() {
  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-gray-200 shadow-sm overflow-hidden max-w-md w-full text-center">
        <div className="bg-gradient-to-r from-blue-800 to-blue-600 px-8 py-10">
          <p className="text-5xl font-bold text-white">404</p>
        </div>
        <div className="p-8">
          <h1 className="text-xl font-bold text-gray-900">Page not found</h1>
          <p className="text-gray-500 mt-2 text-sm">
            The page you're looking for doesn't exist or has moved.
          </p>
          <Link
            to="/dashboard"
            className="inline-block mt-6 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl text-sm font-medium transition"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

export default NotFoundPage;
