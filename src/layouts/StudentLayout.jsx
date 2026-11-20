import { useEffect, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import BrandLogo from "../components/BrandLogo";
import { BRAND } from "../config/brand";

const NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard" },
  { to: "/series", label: "Test Series" },
  { to: "/attempts", label: "My Attempts" },
  { to: "/bookmarks", label: "Bookmarks" },
  { to: "/custom-set", label: "Custom Set" },
];

function StudentLayout() {
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);

  const user = JSON.parse(localStorage.getItem("user"));

  // Escape closes the phone menu
  useEffect(() => {
    if (!menuOpen) return;
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [menuOpen]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    navigate("/login");
  };

  const navClass = ({ isActive }) =>
    `text-sm font-medium transition whitespace-nowrap ${
      isActive
        ? "text-blue-700"
        : "text-gray-500 hover:text-gray-900"
    }`;

  const menuLinkClass = ({ isActive }) =>
    `flex items-center min-h-11 px-3 rounded-xl text-base font-medium transition ${
      isActive
        ? "bg-blue-50 text-blue-700"
        : "text-gray-700 hover:bg-gray-100"
    }`;

  return (
    <div className="min-h-screen bg-gray-100 flex flex-col">
      {/* ================= HEADER ================= */}
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto h-16 px-4 sm:px-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-8 min-w-0">
            <button
              onClick={() => {
                setMenuOpen(false);
                navigate("/dashboard");
              }}
              aria-label="TestPortal home"
              className="shrink-0 min-h-11 flex items-center"
            >
              <BrandLogo height={36} />
            </button>

            {/* desktop navigation */}
            <nav className="hidden lg:flex items-center gap-6">
              {NAV_ITEMS.map((item) => (
                <NavLink key={item.to} to={item.to} className={navClass}>
                  {item.label}
                </NavLink>
              ))}
            </nav>
          </div>

          <div className="hidden lg:flex items-center gap-4 min-w-0">
            {user?.name && (
              <span
                className="text-sm font-medium text-gray-900 truncate max-w-48"
                title={user.name}
              >
                {user.name}
              </span>
            )}

            <button
              onClick={handleLogout}
              className="shrink-0 bg-gray-900 text-white px-4 py-2 rounded-xl text-sm font-medium hover:opacity-90 transition"
            >
              Logout
            </button>
          </div>

          {/* phone / tablet menu button */}
          <button
            onClick={() => setMenuOpen((open) => !open)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            aria-controls="student-menu"
            className="lg:hidden shrink-0 w-11 h-11 -mr-1.5 flex items-center justify-center rounded-xl text-gray-800 hover:bg-gray-100 transition"
          >
            {menuOpen ? (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            ) : (
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M4 7h16M4 12h16M4 17h16" />
              </svg>
            )}
          </button>
        </div>

        {/* phone / tablet menu panel */}
        {menuOpen && (
          <>
            <div
              className="lg:hidden fixed inset-0 top-16 bg-gray-900/30"
              onClick={() => setMenuOpen(false)}
              aria-hidden="true"
            />
            <div
              id="student-menu"
              className="lg:hidden absolute inset-x-0 top-full bg-white border-b border-gray-200 shadow-lg max-h-[calc(100vh-4rem)] overflow-y-auto"
            >
              <nav className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex flex-col gap-1">
                {NAV_ITEMS.map((item) => (
                  <NavLink
                    key={item.to}
                    to={item.to}
                    className={menuLinkClass}
                    onClick={() => setMenuOpen(false)}
                  >
                    {item.label}
                  </NavLink>
                ))}
              </nav>

              <div className="max-w-6xl mx-auto px-4 sm:px-6 pb-4">
                <div className="border-t border-gray-200 pt-3 flex items-center justify-between gap-3">
                  {user?.name && (
                    <span className="text-sm font-medium text-gray-900 truncate min-w-0">
                      {user.name}
                    </span>
                  )}
                  <button
                    onClick={handleLogout}
                    className="shrink-0 ml-auto min-h-11 bg-gray-900 text-white px-5 rounded-xl text-sm font-medium hover:opacity-90 transition"
                  >
                    Logout
                  </button>
                </div>
              </div>
            </div>
          </>
        )}
      </header>

      {/* ================= CONTENT ================= */}
      <main className="flex-1 w-full max-w-6xl mx-auto px-4 py-5 sm:p-6">
        <Outlet />
      </main>

      {/* ================= FOOTER ================= */}
      <footer className="bg-white border-t border-gray-200 px-4 sm:px-6 py-4">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row flex-wrap items-center justify-between gap-3 text-sm text-gray-500">
          <div className="flex items-center gap-2">
            <BrandLogo height={24} showName={false} />
            <span>© {new Date().getFullYear()} {BRAND.name}</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
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
