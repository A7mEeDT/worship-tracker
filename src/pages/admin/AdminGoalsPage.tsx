import { useCallback, useEffect, useMemo, useState } from "react";
import { RefreshCw, Save, Target } from "lucide-react";
import { apiGet, apiPut } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { GlobalGoals } from "@/types/goals";

interface GoalsResponse {
  goals: GlobalGoals;
}

export default function AdminGoalsPage() {
  const [goals, setGoals] = useState<GlobalGoals | null>(null);
  const [daily, setDaily] = useState<number>(40);
  const [weekly, setWeekly] = useState<number>(250);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const response = await apiGet<GoalsResponse>("/api/admin/system/goals");
      setGoals(response.goals);
      setDaily(Math.max(0, Math.trunc(Number(response.goals.dailyGoalPoints ?? 0))));
      setWeekly(Math.max(0, Math.trunc(Number(response.goals.weeklyGoalPoints ?? 0))));
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
      setGoals(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const lastUpdated = useMemo(() => formatDateTime(goals?.updatedAt ?? null), [goals?.updatedAt]);

  const handleSave = async () => {
    setBusy(true);
    setError("");

    try {
      const payload = {
        dailyGoalPoints: Math.max(0, Math.trunc(Number(daily))),
        weeklyGoalPoints: Math.max(0, Math.trunc(Number(weekly))),
      };

      const response = await apiPut<GoalsResponse>("/api/admin/system/goals", payload);
      setGoals(response.goals);
      setDaily(payload.dailyGoalPoints);
      setWeekly(payload.weeklyGoalPoints);
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
            <Target size={20} className="text-cyan-700" />
            الأهداف العامة
          </h1>
          <p className="text-sm text-slate-500">
            ضبط هدف يومي وهدف أسبوعي موحّد لجميع المستخدمين. يتم عرض الأهداف داخل تبويب التقارير عند جميع المستخدمين.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void load()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            <RefreshCw size={16} />
            تحديث
          </button>
          <button
            type="button"
            disabled={busy || loading}
            onClick={() => void handleSave()}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {busy ? "جارٍ الحفظ..." : "حفظ"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">الهدف اليومي</p>
          <div className="mt-3 flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <input
                type="number"
                min={0}
                max={100000}
                value={daily}
                onChange={(e) => setDaily(Math.max(0, Math.trunc(Number(e.target.value || 0))))}
                className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg font-black text-slate-900 outline-none ring-cyan-600/50 focus:ring-2"
              />
            )}
            <span className="text-sm font-semibold text-slate-600">نقطة</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">إذا كان 0 سيتم إخفاء شريط التقدم للهدف اليومي.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">الهدف الأسبوعي</p>
          <div className="mt-3 flex items-center gap-3">
            {loading ? (
              <Skeleton className="h-10 w-32" />
            ) : (
              <input
                type="number"
                min={0}
                max={100000}
                value={weekly}
                onChange={(e) => setWeekly(Math.max(0, Math.trunc(Number(e.target.value || 0))))}
                className="w-40 rounded-xl border border-slate-300 bg-white px-3 py-2 text-lg font-black text-slate-900 outline-none ring-cyan-600/50 focus:ring-2"
              />
            )}
            <span className="text-sm font-semibold text-slate-600">نقطة</span>
          </div>
          <p className="mt-2 text-xs text-slate-500">إذا كان 0 سيتم إخفاء شريط التقدم للهدف الأسبوعي.</p>
        </article>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-700">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="font-semibold">آخر تحديث</div>
          <div>{loading ? "--" : lastUpdated}</div>
        </div>
        <p className="mt-2 text-xs text-slate-600">
          ملاحظة: يتم تطبيق الأهداف على جميع المستخدمين فور الحفظ (بدون الحاجة لتحديث قاعدة بيانات لأن التخزين نصّي).
        </p>
      </div>
    </section>
  );
}

