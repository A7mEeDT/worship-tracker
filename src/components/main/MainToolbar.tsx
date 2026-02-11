import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function MainToolbar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);

  const canAccessAdmin = user?.role === "admin" || user?.role === "primary_admin";

  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="fixed top-4 left-4 right-4 z-40" dir="ltr">
      <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-widest text-slate-500">Authenticated</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {user?.username} • {user?.role}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {canAccessAdmin && (
              <>
                <Link
                  to="/admin/dashboard"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <LayoutDashboard size={14} />
                  Dashboard
                </Link>
                <Link
                  to="/admin/notifications"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Bell size={14} />
                  Notifications
                </Link>
              </>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-70"
            >
              <LogOut size={14} />
              {loggingOut ? "Signing out..." : "Sign out"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
