import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, RefreshCw, ShieldCheck, ShieldOff } from "lucide-react";
import QRCode from "qrcode";
import { apiGet, apiPost } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/hooks/use-auth";
import type { TwoFactorSetupResponse, TwoFactorStatusResponse } from "@/types/admin";

interface TwoFactorVerifyResponse {
  status: string;
  enabledAt?: string | null;
}

function statusLabel(status: TwoFactorStatusResponse["status"]) {
  if (status === "enabled") return "مفعل";
  if (status === "pending") return "قيد الإعداد";
  return "غير مفعل";
}

export default function AdminSecurityPage() {
  const { user } = useAuth();

  const [status, setStatus] = useState<TwoFactorStatusResponse | null>(null);
  const [setup, setSetup] = useState<TwoFactorSetupResponse | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>("");

  const [otp, setOtp] = useState("");
  const [disableOtp, setDisableOtp] = useState("");
  const [disablePassword, setDisablePassword] = useState("");
  const [resetUsername, setResetUsername] = useState("");

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const isPrimaryAdmin = user?.role === "primary_admin";

  const loadStatus = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<TwoFactorStatusResponse>("/api/admin/security/2fa/status");
      setStatus(response);
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
      setStatus(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const enabledAtLabel = useMemo(() => formatDateTime(status?.enabledAt ?? null), [status?.enabledAt]);

  const handleSetup = async () => {
    setBusy(true);
    setError("");
    setSetup(null);
    setQrDataUrl("");
    setOtp("");

    try {
      const response = await apiPost<TwoFactorSetupResponse>("/api/admin/security/2fa/setup");
      setSetup(response);
      const url = await QRCode.toDataURL(response.otpauthUrl, { margin: 1, width: 240 });
      setQrDataUrl(url);
      await loadStatus();
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleVerify = async () => {
    setBusy(true);
    setError("");

    try {
      await apiPost<TwoFactorVerifyResponse>("/api/admin/security/2fa/verify", {
        otp: otp.trim(),
      });
      setSetup(null);
      setQrDataUrl("");
      setOtp("");
      await loadStatus();
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleCancel = async () => {
    setBusy(true);
    setError("");

    try {
      await apiPost("/api/admin/security/2fa/cancel");
      setSetup(null);
      setQrDataUrl("");
      setOtp("");
      await loadStatus();
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async () => {
    if (!confirm("سيتم إيقاف المصادقة الثنائية لهذا الحساب. هل تريد المتابعة؟")) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiPost("/api/admin/security/2fa/disable", {
        password: disablePassword,
        otp: disableOtp.trim(),
      });
      setDisablePassword("");
      setDisableOtp("");
      await loadStatus();
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const handleReset = async () => {
    const target = resetUsername.trim();
    if (!target) {
      setError("يرجى إدخال اسم المستخدم.");
      return;
    }

    if (!confirm(`سيتم إعادة ضبط 2FA للمستخدم ${target}. هل تريد المتابعة؟`)) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiPost("/api/admin/security/2fa/reset", { username: target });
      setResetUsername("");
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const statusChip = (
    <span
      className={`inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-bold ${
        status?.status === "enabled"
          ? "bg-emerald-100 text-emerald-800"
          : status?.status === "pending"
            ? "bg-amber-100 text-amber-900"
            : "bg-slate-100 text-slate-700"
      }`}
    >
      <ShieldCheck size={14} />
      {loading ? "..." : statusLabel(status?.status ?? "disabled")}
    </span>
  );

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
            <KeyRound size={20} className="text-cyan-700" />
            الأمان
          </h1>
          <p className="text-sm text-slate-500">إعداد المصادقة الثنائية (2FA) لحسابات المشرفين عبر تطبيقات TOTP.</p>
        </div>

        <div className="flex items-center gap-2">
          {statusChip}
          <button
            type="button"
            onClick={() => void loadStatus()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            <RefreshCw size={16} />
            تحديث
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-5 lg:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black text-slate-900">المصادقة الثنائية (2FA)</h2>
          <p className="mt-1 text-sm text-slate-600">
            عند تفعيل 2FA سيطلب النظام رمزًا (6 أرقام) عند تسجيل الدخول للمشرف.
          </p>

          <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-semibold">الحالة</div>
              {loading ? <Skeleton className="h-5 w-24" /> : statusChip}
            </div>
            {status?.status === "enabled" && (
              <p className="mt-2 text-xs text-slate-600">
                مفعل منذ: <span className="font-semibold">{enabledAtLabel}</span>
              </p>
            )}
            {status?.enforce && (
              <p className="mt-2 text-xs text-amber-900">
                ملاحظة: سياسة النظام حالياً تفرض تفعيل 2FA للوصول إلى لوحة الإدارة.
              </p>
            )}
          </div>

          {loading ? (
            <div className="mt-4 space-y-2">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          ) : status?.status !== "enabled" ? (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleSetup()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <ShieldCheck size={16} />
                {busy ? "جارٍ البدء..." : "بدء إعداد 2FA"}
              </button>

              {setup && (
                <div className="rounded-2xl border border-slate-200 bg-white p-4">
                  <p className="text-sm font-bold text-slate-900">1) امسح QR من تطبيق المصادقة</p>
                  {qrDataUrl ? (
                    <div className="mt-3 flex justify-center">
                      <img src={qrDataUrl} alt="QR Code" className="h-56 w-56 rounded-xl border border-slate-200" />
                    </div>
                  ) : (
                    <div className="mt-3">
                      <Skeleton className="h-56 w-full" />
                    </div>
                  )}

                  <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-xs text-slate-700">
                    <p className="font-semibold">أو أدخل المفتاح يدوياً:</p>
                    <p className="mt-1 break-all font-mono text-[12px]">{setup.secret}</p>
                  </div>

                  <p className="mt-4 text-sm font-bold text-slate-900">2) أدخل الرمز للتحقق</p>
                  <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                    <input
                      inputMode="numeric"
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/[^\d]/gu, "").slice(0, 6))}
                      placeholder="123456"
                      autoComplete="one-time-code"
                    />
                    <button
                      type="button"
                      disabled={busy || otp.trim().length !== 6}
                      onClick={() => void handleVerify()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      <ShieldCheck size={16} />
                      تفعيل
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => void handleCancel()}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      إلغاء
                    </button>
                  </div>

                  {status?.enforce && (
                    <p className="mt-3 text-xs text-slate-600">
                      بعد التفعيل سيتم تحديث الجلسة تلقائيًا. إذا واجهت رسالة تطلب 2FA، سجّل الخروج ثم ادخل مرة أخرى.
                    </p>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-900">
                <p className="font-bold">إيقاف 2FA</p>
                <p className="mt-1 text-xs text-rose-800">
                  ننصح بعدم إيقاف 2FA إلا للضرورة. ستحتاج كلمة المرور والرمز الحالي لإكمال العملية.
                </p>

                <label className="mt-3 block text-xs font-semibold text-rose-900">كلمة المرور</label>
                <input
                  type="password"
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none ring-rose-400/50 focus:ring-2"
                  value={disablePassword}
                  onChange={(e) => setDisablePassword(e.target.value)}
                  autoComplete="current-password"
                />

                <label className="mt-3 block text-xs font-semibold text-rose-900">رمز 2FA (6 أرقام)</label>
                <input
                  inputMode="numeric"
                  className="mt-1 w-full rounded-xl border border-rose-200 bg-white px-3 py-2 text-sm outline-none ring-rose-400/50 focus:ring-2"
                  value={disableOtp}
                  onChange={(e) => setDisableOtp(e.target.value.replace(/[^\d]/gu, "").slice(0, 6))}
                  autoComplete="one-time-code"
                  placeholder="123456"
                />

                <button
                  type="button"
                  disabled={busy || disablePassword.length === 0 || disableOtp.trim().length !== 6}
                  onClick={() => void handleDisable()}
                  className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldOff size={16} />
                  {busy ? "جارٍ الإيقاف..." : "إيقاف 2FA"}
                </button>
              </div>
            </div>
          )}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="text-sm font-black text-slate-900">ملاحظات</h2>
          <ul className="mt-3 list-disc space-y-2 pr-5 text-sm text-slate-700">
            <li>استخدم تطبيق مصادقة مثل Google Authenticator أو Microsoft Authenticator.</li>
            <li>الرمز يتغير كل 30 ثانية. تأكد من ضبط الوقت في هاتفك.</li>
            <li>لا يتم عرض الإجابات الصحيحة/الأسرار للمستخدمين الآخرين.</li>
          </ul>

          {isPrimaryAdmin && (
            <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm font-bold text-slate-900">إعادة ضبط 2FA لمستخدم (Primary Admin)</p>
              <p className="mt-1 text-xs text-slate-600">
                استخدمها فقط عند فقدان الجهاز. سيتم تعطيل 2FA للمستخدم المستهدف.
              </p>
              <div className="mt-3 flex flex-col gap-2 sm:flex-row">
                <input
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
                  value={resetUsername}
                  onChange={(e) => setResetUsername(e.target.value)}
                  placeholder="اسم المستخدم"
                />
                <button
                  type="button"
                  disabled={busy || resetUsername.trim().length === 0}
                  onClick={() => void handleReset()}
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <ShieldOff size={16} />
                  إعادة ضبط
                </button>
              </div>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

