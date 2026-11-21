import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { loginUser } from "../../services/auth.service";
import { purgeOtherUsersQueues } from "../../lib/saveQueue";
import BrandLogo from "../../components/BrandLogo";

function LoginPage() {
  const navigate = useNavigate();

  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });

  const [loading, setLoading] = useState(false);

  const [error, setError] = useState("");

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      setLoading(true);
      setError("");

      const data = await loginUser(formData);

      localStorage.setItem("token", data.token);

      localStorage.setItem(
        "user",
        JSON.stringify(data.user)
      );

      // unsent test saves left on this device by a different student are
      // never sent under this login
      purgeOtherUsersQueues(data.user?.id);

      navigate("/dashboard");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md bg-white rounded-3xl border border-gray-200 shadow-lg p-6 sm:p-8">
      {/* Logo */}
      <div className="mb-8 sm:mb-10">
        <h1 className="m-0">
          <BrandLogo height={56} smallHeight={40} textClassName="text-2xl sm:text-3xl" />
        </h1>

        <p className="text-gray-500 mt-4">
          Continue your preparation journey
        </p>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-5 bg-red-100 text-red-700 px-4 py-3 rounded-2xl text-sm">
          {error}
        </div>
      )}

      {/* Form */}
      <form
        className="space-y-6"
        onSubmit={handleSubmit}
      >
        {/* Email */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Email Address
          </label>

          <input
            type="email"
            name="email"
            placeholder="Enter your email"
            value={formData.email}
            onChange={handleChange}
            className="
              w-full
              rounded-2xl
              border
              border-gray-300
              px-4
              py-3
              outline-none
              transition
              focus:border-black
              focus:ring-4
              focus:ring-gray-200
            "
          />
        </div>

        {/* Password */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Password
          </label>

          <input
            type="password"
            name="password"
            placeholder="Enter your password"
            value={formData.password}
            onChange={handleChange}
            className="
              w-full
              rounded-2xl
              border
              border-gray-300
              px-4
              py-3
              outline-none
              transition
              focus:border-black
              focus:ring-4
              focus:ring-gray-200
            "
          />
        </div>

        {/* Button */}
        <button
          type="submit"
          disabled={loading}
          className="
            w-full
            bg-gradient-to-r
            from-blue-700
            to-blue-600
            text-white
            py-3.5
            rounded-2xl
            font-medium
            transition
            hover:opacity-90
            active:scale-[0.99]
            disabled:opacity-50
          "
        >
          {loading ? "Logging in..." : "Login"}
        </button>
      </form>
    </div>
  );
}

export default LoginPage;