import { Routes, Route, Navigate } from "react-router-dom";

import AuthLayout from "../layouts/AuthLayout";
import StudentLayout from "../layouts/StudentLayout";

import LoginPage from "../pages/auth/LoginPage";
import DashboardPage from "../pages/dashboard/DashboardPage";

import NotFoundPage from "../pages/NotFoundPage";

import ProtectedRoute from "./ProtectedRoute";

import InstructionsPage from "../pages/test/InstructionsPage";
import AttemptPage from "../pages/attempt/AttemptPage";
import ResultPage from "../pages/result/ResultPage";
import PackageDetailPage from "../pages/packages/PackageDetailPage";

function AppRoutes() {
    return (
        <Routes>
            {/* Redirect */}
            <Route
                path="/"
                element={<Navigate to="/dashboard" />}
            />

            {/* Auth */}
            <Route
                path="/login"
                element={
                    <AuthLayout>
                        <LoginPage />
                    </AuthLayout>
                }
            />

            {/* Test screen — deliberately OUTSIDE StudentLayout so there is no
                top navigation bar while a test is in progress */}
            <Route
                path="/attempt/:attemptId"
                element={
                    <ProtectedRoute>
                        <div className="min-h-screen bg-gray-100 p-6">
                            <AttemptPage />
                        </div>
                    </ProtectedRoute>
                }
            />

            {/* Protected Student Routes */}
            <Route
                element={
                    <ProtectedRoute>
                        <StudentLayout />
                    </ProtectedRoute>
                }
            >
                <Route
                    path="/dashboard"
                    element={<DashboardPage />}
                />

                {/* Test Series (Packages) */}
                <Route
                    path="/packages/:id"
                    element={<PackageDetailPage />}
                />

                {/* Instructions Page */}
                <Route
                    path="/test/:testId/instructions"
                    element={<InstructionsPage />}
                />

                {/* Result Page */}
                <Route
                    path="/result/:attemptId"
                    element={<ResultPage />}
                />

            </Route>

            {/* 404 */}
            <Route
                path="*"
                element={<NotFoundPage />}
            />
        </Routes>
    );
}

export default AppRoutes;