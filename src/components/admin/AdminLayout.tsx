import { useMemo, useState } from "react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { Bell, HardDrive, HelpCircle, KeyRound, LayoutDashboard, LogOut, Menu, ScrollText, ShieldCheck, Users } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { roleLabel } from "@/lib/error-messages";

const navItems = [
  { to: "/admin/dashboard", label: "لوحة المراقبة", icon: LayoutDashboard },
  { to: "/admin/users", label: "المستخدمون", icon: Users },
  { to: "/admin/questions", label: "الأسئلة", icon: HelpCircle },
  { to: "/admin/notifications", label: "الإشعارات", icon: Bell },
  { to: "/admin/audit", label: "سجل التدقيق", icon: ScrollText },
  { to: "/admin/storage", label: "التخزين", icon: HardDrive },
  { to: "/admin/security", label: "الأمان", icon: KeyRound },
];

export default function AdminLayout() {
  const { user, logout } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const navigate = useNavigate();

  const initials = useMemo(() => user?.username.slice(0, 2).toUpperCase() ?? "--", [user?.username]);

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-cyan-900 px-4 py-3 text-white shadow-lg">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 text-white md:hidden"
              onClick={() => setMobileOpen((value) => !value)}
              aria-label="فتح/إغلاق قائمة الإدارة"
            >
              <Menu size={18} />
            </button>
            <Link to="/admin/dashboard" className="flex items-center gap-2 text-sm font-semibold tracking-widest">
              <ShieldCheck size={16} />
              لوحة الإدارة
            </Link>
          </div>
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block">
              <p className="text-xs tracking-wider text-cyan-200">مسجل الدخول</p>
              <p className="text-sm font-semibold">{user?.username} • {roleLabel(user?.role)}</p>
            </div>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-white/20 text-xs font-semibold">
              {initials}
            </div>
            <button
              className="inline-flex items-center gap-1 rounded-lg bg-white/15 px-3 py-2 text-xs font-semibold hover:bg-white/25"
              onClick={handleLogout}
            >
              <LogOut size={14} />
              تسجيل الخروج
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-5 px-4 py-5 md:grid-cols-[240px_1fr]">
        <aside className={`${mobileOpen ? "block" : "hidden"} rounded-2xl border border-slate-200 bg-white p-3 shadow-sm md:block`}>
          <nav className="space-y-1">
            {navItems.map(({ to, label, icon: Icon }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) =>
                  `flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition ${
                    isActive
                      ? "bg-slate-900 text-white shadow"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  }`
                }
                onClick={() => setMobileOpen(false)}
              >
                <Icon size={16} />
                {label}
              </NavLink>
            ))}
          </nav>
        </aside>

        <main className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
