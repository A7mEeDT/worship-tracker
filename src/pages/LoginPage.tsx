import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError("");
    setSubmitting(true);

    try {
      const currentUser = await login(username, password);
      const from = typeof location.state?.from === "string" ? location.state.from : null;
      const defaultPath = currentUser.role === "user" ? "/" : "/admin/dashboard";
      navigate(from || defaultPath, { replace: true });
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Login failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 px-4 py-10 text-slate-100" dir="ltr">
      <div className="mx-auto grid max-w-5xl gap-8 rounded-3xl border border-slate-700/60 bg-slate-950/80 p-6 shadow-2xl md:grid-cols-[1.2fr_1fr] md:p-10">
        <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-cyan-500/10 via-slate-900 to-slate-900 p-6 md:p-8">
          <p className="text-xs uppercase tracking-[0.22em] text-cyan-200">Security</p>
          <h1 className="mt-3 text-3xl font-black tracking-tight text-white md:text-4xl">
            Monitoring & Access Control
          </h1>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-slate-300">
            Sign in with your assigned credentials. Role-based controls are enforced server-side for all dashboard, user
            management, and notification endpoints.
          </p>
          <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold uppercase tracking-wide text-cyan-100">
            <ShieldCheck size={14} />
            JWT session + RBAC + activity logging
          </div>
        </div>

        <form className="rounded-2xl border border-slate-700 bg-slate-900 p-6 md:p-8" onSubmit={handleSubmit}>
          <h2 className="text-2xl font-bold text-white">Sign in</h2>
          <p className="mt-1 text-sm text-slate-400">Use your user/admin account credentials.</p>

          <label className="mt-6 block text-xs font-semibold uppercase tracking-wider text-slate-300">Username</label>
          <input
            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400/60 transition focus:ring-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            required
          />

          <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-slate-300">Password</label>
          <input
            type="password"
            className="mt-2 w-full rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 text-sm text-slate-100 outline-none ring-cyan-400/60 transition focus:ring-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {error && (
            <div className="mt-4 rounded-xl border border-rose-400/40 bg-rose-500/10 px-3 py-2 text-sm text-rose-200">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-cyan-500 px-4 py-3 text-sm font-bold text-slate-950 transition hover:bg-cyan-400 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
