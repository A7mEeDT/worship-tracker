import { Suspense, lazy } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import PageActivityTracker from "@/components/auth/PageActivityTracker";
import { t } from "@/i18n";
import LoginPage from "./pages/LoginPage";
import MainSitePage from "./pages/MainSitePage";
import NotFound from "./pages/NotFound";

const AdminLayout = lazy(() => import("@/components/admin/AdminLayout"));
const AdminDashboardPage = lazy(() => import("./pages/admin/AdminDashboardPage"));
const AdminUsersPage = lazy(() => import("./pages/admin/AdminUsersPage"));
const AdminQuestionsPage = lazy(() => import("./pages/admin/AdminQuestionsPage"));
const AdminNotificationsPage = lazy(() => import("./pages/admin/AdminNotificationsPage"));
const AdminAuditLogPage = lazy(() => import("./pages/admin/AdminAuditLogPage"));
const AdminStoragePage = lazy(() => import("./pages/admin/AdminStoragePage"));
const AdminSecurityPage = lazy(() => import("./pages/admin/AdminSecurityPage"));
const AdminGoalsPage = lazy(() => import("./pages/admin/AdminGoalsPage"));

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <PageActivityTracker />
          <Suspense
            fallback={
              <div className="min-h-screen flex items-center justify-center text-sm text-muted-foreground">
                {t("app_loading")}
              </div>
            }
          >
            <Routes>
              <Route path="/login" element={<LoginPage />} />
              <Route
                path="/"
                element={
                  <ProtectedRoute allowedRoles={["user", "admin", "primary_admin"]}>
                    <MainSitePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={["admin", "primary_admin"]}>
                    <AdminLayout />
                  </ProtectedRoute>
                }
              >
                <Route index element={<Navigate to="dashboard" replace />} />
                <Route path="dashboard" element={<AdminDashboardPage />} />
                <Route path="goals" element={<AdminGoalsPage />} />
                <Route path="users" element={<AdminUsersPage />} />
                <Route path="questions" element={<AdminQuestionsPage />} />
                <Route path="notifications" element={<AdminNotificationsPage />} />
                <Route path="audit" element={<AdminAuditLogPage />} />
                <Route path="storage" element={<AdminStoragePage />} />
                <Route path="security" element={<AdminSecurityPage />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
