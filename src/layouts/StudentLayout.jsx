import { NavLink, Outlet, useNavigate } from "react-router-dom";

function StudentLayout() {
  const navigate = useNavigate();

  const user = JSON.parse(
    localStorage.getItem("user")
  );

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");

    navigate("/login");
  };

  const navClass = ({ isActive }) =>
    `text-sm font-medium transition ${
      isActive
        ? "text-gray-900"
        : "text-gray-500 hover:text-gray-900"
    }`;

  return (
    <div className="min-h-screen bg-gray-100">
      <header className="h-16 bg-white border-b border-gray-200 px-6 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <h1
            onClick={() => navigate("/dashboard")}
            className="text-2xl font-bold text-gray-900 cursor-pointer"
          >
            TestPortal
          </h1>

          <nav className="flex items-center gap-6">
            <NavLink to="/dashboard" className={navClass}>
              Dashboard
            </NavLink>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          <p className="text-sm font-medium text-gray-900">
            {user?.name}
          </p>

          <button
            onClick={handleLogout}
            className="
              bg-black
              text-white
              px-4
              py-2
              rounded-xl
              text-sm
              hover:opacity-90
              transition
            "
          >
            Logout
          </button>
        </div>
      </header>

      <main className="p-6">
        <Outlet />
      </main>
    </div>
  );
}

export default StudentLayout;