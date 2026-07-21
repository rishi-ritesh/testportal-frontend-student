import { NavLink, Outlet, useNavigate } from "react-router-dom";

function StudentLayout() {
  const navigate = useNavigate();

  const user = JSON.parse(localStorage.getItem("user"));

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const navClass = ({ isActive }) =>
    `text-sm font-medium transition ${
      isActive
        ? "text-blue-700"
        : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ================= HEADER ================= */}
      <header className="h-16 bg-white border-b border-gray-200 shadow-sm px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={() => navigate("/dashboard")}
            className="flex items-center gap-2.5"
          >
            <span className="w-9 h-9 rounded-xl bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-white font-bold shadow-sm">
              T
            </span>
            <span className="text-xl font-bold text-gray-900">TestPortal</span>
          </button>

          <nav className="flex items-center gap-6">
            <NavLink to="/dashboard" className={navClass}>
              Dashboard
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {user?.name && (
            <span className="text-sm font-medium text-gray-900">
              {user.name}
            </span>
          )}

          <button
            onClick={handleLogout}
            className="bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
          >
            Logout
          </button>
        </div>
      </header>

      {/* ================= CONTENT ================= */}
      <main className="flex-1 p-6">
        <Outlet />
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-white border-t border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <span className="w-6 h-6 rounded-lg bg-gradient-to-br from-blue-700 to-blue-500 flex items-center justify-center text-white text-xs font-bold">
              T
            </span>
            <span>© {new Date().getFullYear()} TestPortal</span>
          </div>
          <div className="flex items-center gap-5">
            <span className="hover:text-gray-900 transition cursor-default">About</span>
            <span className="hover:text-gray-900 transition cursor-default">Help</span>
            <span className="hover:text-gray-900 transition cursor-default">Contact</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default StudentLayout;
