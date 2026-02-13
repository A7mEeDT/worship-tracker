import { FormEvent, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { ShieldCheck, Sunrise } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { ApiError } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";

export default function LoginPage() {
  const { user, login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
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
      const currentUser = await login(username, password, otp.trim() ? otp.trim() : undefined);
      const from = typeof location.state?.from === "string" ? location.state.from : null;
      const defaultPath = currentUser.role === "user" ? "/" : "/admin/dashboard";
      navigate(from || defaultPath, { replace: true });
    } catch (requestError) {
      if (requestError instanceof ApiError) {
        if (requestError.code === "TOTP_REQUIRED" || requestError.code === "TOTP_INVALID") {
          setOtpRequired(true);
        }
      }
      setError(getArabicErrorMessage(requestError));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-gradient-to-br from-amber-50 via-orange-100 to-rose-200 px-4 py-6 sm:py-10">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -top-24 -right-24 h-72 w-72 rounded-full bg-white/50 blur-3xl" />
        <div className="absolute -bottom-28 -left-28 h-80 w-80 rounded-full bg-amber-200/60 blur-3xl" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(255,255,255,0.75),transparent_55%)]" />
      </div>

      <div className="relative mx-auto grid max-w-5xl gap-6 rounded-3xl border border-white/60 bg-white/70 p-5 shadow-2xl backdrop-blur sm:gap-8 sm:p-6 md:grid-cols-[1.15fr_1fr] md:p-10">
        <div className="order-2 rounded-2xl border border-white/70 bg-gradient-to-br from-white/70 via-white/50 to-amber-100/60 p-5 sm:p-6 md:order-1 md:p-8">
          <p className="text-xs font-semibold tracking-[0.22em] text-amber-700/80">ثيم شروق الشمس</p>
          <h1 className="mt-3 flex items-center gap-3 font-heading text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">
            <Sunrise size={28} className="text-amber-600" />
            متتبع العبادات
          </h1>
          <p className="mt-4 hidden max-w-md text-sm leading-relaxed text-slate-700/80 sm:block">
            سجل عباداتك اليومية وابدأ باستخدام حسابك. الصلاحيات (مستخدم/مشرف) يتم فرضها من جهة الخادم لحماية النظام.
          </p>

          <div className="mt-6 hidden items-center gap-2 rounded-full border border-amber-300/70 bg-amber-200/40 px-4 py-2 text-xs font-semibold tracking-wide text-amber-900/80 sm:inline-flex">
            <ShieldCheck size={14} />
            جلسة آمنة + صلاحيات + سجل نشاط
          </div>
        </div>

        <form className="order-1 rounded-2xl border border-white/70 bg-white/60 p-5 md:order-2 md:p-8" onSubmit={handleSubmit} dir="rtl">
          <h2 className="font-heading text-2xl font-bold text-slate-900">تسجيل الدخول</h2>
          <p className="mt-1 text-sm text-slate-700/70">استخدم بيانات حسابك (مستخدم/مشرف).</p>

          <label className="mt-6 block text-sm font-semibold tracking-wide text-slate-700">اسم المستخدم</label>
          <input
            dir="ltr"
            inputMode="email"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-2 w-full h-12 rounded-2xl border border-white/80 bg-white/80 px-4 py-3.5 text-base text-slate-900 outline-none ring-amber-300/70 transition placeholder:text-slate-500/70 focus:ring-2"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            placeholder="مثال: admin@z2data"
            required
          />

          <label className="mt-4 block text-sm font-semibold tracking-wide text-slate-700">كلمة المرور</label>
          <input
            type="password"
            dir="ltr"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="mt-2 w-full h-12 rounded-2xl border border-white/80 bg-white/80 px-4 py-3.5 text-base text-slate-900 outline-none ring-amber-300/70 transition focus:ring-2"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />

          {otpRequired && (
            <>
              <label className="mt-4 block text-sm font-semibold tracking-wide text-slate-700">رمز المصادقة الثنائية (6 أرقام)</label>
              <input
                dir="ltr"
                inputMode="numeric"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="mt-2 w-full h-12 rounded-2xl border border-white/80 bg-white/80 px-4 py-3.5 text-base text-slate-900 outline-none ring-amber-300/70 transition focus:ring-2"
                value={otp}
                onChange={(event) => setOtp(event.target.value.replace(/[^\d]/gu, "").slice(0, 6))}
                autoComplete="one-time-code"
                placeholder="مثال: 123456"
                required
              />
            </>
          )}

          {error && (
            <div className="mt-4 rounded-2xl border border-rose-300/70 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-6 inline-flex w-full items-center justify-center rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-rose-500 px-4 py-3.5 text-base font-bold text-white shadow-lg transition hover:opacity-95 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "جارٍ تسجيل الدخول..." : "دخول"}
          </button>
        </form>
      </div>
    </div>
  );
}
