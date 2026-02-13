import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bell, LayoutDashboard, LogOut } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { roleLabel } from "@/lib/error-messages";
import InstallPwaButton from "@/components/pwa/InstallPwaButton";

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
    <div className="fixed top-4 left-4 right-4 z-40">
      <div className="mx-auto max-w-5xl rounded-xl border border-slate-200 bg-white/95 px-4 py-2 shadow-md backdrop-blur">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs tracking-widest text-slate-500">مسجل الدخول</p>
            <p className="truncate text-sm font-semibold text-slate-800">
              {user?.username} • {roleLabel(user?.role)}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <InstallPwaButton />
            {canAccessAdmin && (
              <>
                <Link
                  to="/admin/dashboard"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <LayoutDashboard size={14} />
                  الإدارة
                </Link>
                <Link
                  to="/admin/notifications"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  <Bell size={14} />
                  الإشعارات
                </Link>
              </>
            )}
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-2 text-xs font-semibold text-white transition hover:bg-slate-700 disabled:opacity-70"
            >
              <LogOut size={14} />
              {loggingOut ? "جارٍ تسجيل الخروج..." : "خروج"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
