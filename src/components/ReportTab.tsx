import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, RefreshCw, Trash2, BarChart3, UserRound, Flame, Target, Calendar } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { Skeleton } from "@/components/ui/skeleton";
import { getArabicErrorMessage } from "@/lib/error-messages";
import type { ReportRecord, ReportWindow } from "@/types/reports";

interface Props {
  getReports: (window: ReportWindow, usernameFilter?: string) => Promise<ReportRecord[]>;
  exportReports: (window: ReportWindow, usernameFilter?: string) => Promise<void>;
  clearAllData: () => Promise<void>;
}

const WINDOWS: { key: ReportWindow; label: string }[] = [
  { key: "1d", label: "1D" },
  { key: "7d", label: "7D" },
  { key: "1w", label: "1W" },
  { key: "1m", label: "1M" },
  { key: "all", label: "الكل" },
];

function toLocalDateOnly(date: Date) {
  const d = new Date(date);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateOnlyLocal(value: string) {
  const [y, m, d] = String(value ?? "").split("-").map((part) => Number(part));
  if (!Number.isFinite(y) || !Number.isFinite(m) || !Number.isFinite(d)) {
    return null;
  }
  const date = new Date(y, m - 1, d);
  return Number.isNaN(date.getTime()) ? null : date;
}

function startOfWeekSaturday(date: Date) {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0=Sun ... 6=Sat
  const offset = (day - 6 + 7) % 7;
  d.setDate(d.getDate() - offset);
  return d;
}

const ReportTab = ({ getReports, exportReports, clearAllData }: Props) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "primary_admin";

  const [windowKey, setWindowKey] = useState<ReportWindow>("1m");
  const [selectedUsername, setSelectedUsername] = useState("all");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const goalStorageKey = `weekly_goal_points:${String(user?.username ?? "me").toLowerCase()}`;
  const [weeklyGoal, setWeeklyGoal] = useState<number>(() => {
    try {
      const raw = localStorage.getItem(goalStorageKey);
      const parsed = raw ? Number(raw) : NaN;
      return Number.isFinite(parsed) && parsed > 0 ? Math.trunc(parsed) : 250;
    } catch {
      return 250;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(goalStorageKey, String(weeklyGoal));
    } catch {
      // Ignore storage errors.
    }
  }, [goalStorageKey, weeklyGoal]);

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const next = await getReports(windowKey);
      setReports(next);
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
      setReports([]);
    } finally {
      setLoading(false);
    }
  }, [getReports, windowKey]);

  useEffect(() => {
    void loadReports();
  }, [loadReports]);

  const usernames = useMemo(() => {
    if (!isAdmin) {
      return [];
    }

    return Array.from(new Set(reports.map((report) => report.username))).sort((a, b) => a.localeCompare(b));
  }, [reports, isAdmin]);

  useEffect(() => {
    if (!isAdmin) {
      setSelectedUsername("all");
      return;
    }

    if (selectedUsername !== "all" && !usernames.includes(selectedUsername)) {
      setSelectedUsername("all");
    }
  }, [isAdmin, selectedUsername, usernames]);

  const visibleReports = useMemo(() => {
    if (!isAdmin || selectedUsername === "all") {
      return reports;
    }

    return reports.filter((entry) => entry.username === selectedUsername);
  }, [reports, isAdmin, selectedUsername]);

  const maxPoints = Math.max(...visibleReports.map((entry) => entry.totalPoints), 1);

  const pointsByDate = useMemo(() => {
    const map = new Map<string, number>();
    for (const entry of visibleReports) {
      const key = String(entry.date ?? "").trim();
      if (!key) {
        continue;
      }
      map.set(key, (map.get(key) ?? 0) + (entry.totalPoints ?? 0));
    }
    return map;
  }, [visibleReports]);

  const weekSummary = useMemo(() => {
    const now = new Date();
    const start = startOfWeekSaturday(now);
    const end = new Date(start);
    end.setDate(start.getDate() + 6);
    end.setHours(23, 59, 59, 999);

    let total = 0;
    for (const entry of visibleReports) {
      const date = parseDateOnlyLocal(entry.date);
      if (!date) {
        continue;
      }
      if (date >= start && date <= end) {
        total += entry.totalPoints ?? 0;
      }
    }

    return { start, end, total };
  }, [visibleReports]);

  const viewingSingleUser = !isAdmin || selectedUsername !== "all";

  const currentStreak = useMemo(() => {
    if (!viewingSingleUser) {
      return null;
    }

    const dateSet = new Set(pointsByDate.keys());
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let cursor = today;
    let key = toLocalDateOnly(cursor);

    // If user didn't save today, allow streak to start from yesterday.
    if (!dateSet.has(key)) {
      cursor = new Date(cursor);
      cursor.setDate(cursor.getDate() - 1);
      key = toLocalDateOnly(cursor);
      if (!dateSet.has(key)) {
        return 0;
      }
    }

    let streak = 0;
    while (dateSet.has(key)) {
      streak += 1;
      cursor.setDate(cursor.getDate() - 1);
      key = toLocalDateOnly(cursor);
    }

    return streak;
  }, [pointsByDate, viewingSingleUser]);

  const bestStreak = useMemo(() => {
    if (!viewingSingleUser) {
      return null;
    }

    const dates = Array.from(pointsByDate.keys()).sort((a, b) => a.localeCompare(b));
    let best = 0;
    let current = 0;
    let previous: Date | null = null;

    for (const dateStr of dates) {
      const date = parseDateOnlyLocal(dateStr);
      if (!date) {
        continue;
      }

      if (!previous) {
        current = 1;
      } else {
        const diffDays = Math.round((date.getTime() - previous.getTime()) / (24 * 60 * 60 * 1000));
        current = diffDays === 1 ? current + 1 : 1;
      }

      best = Math.max(best, current);
      previous = date;
    }

    return best;
  }, [pointsByDate, viewingSingleUser]);

  const heatmap = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const currentWeekStart = startOfWeekSaturday(today);

    const values = Array.from(pointsByDate.values());
    const maxValue = Math.max(...values, 1);

    const weeks = [];
    for (let w = 0; w < 12; w += 1) {
      const weekStart = new Date(currentWeekStart);
      weekStart.setDate(currentWeekStart.getDate() - w * 7);

      const days = [];
      for (let d = 0; d < 7; d += 1) {
        const dayDate = new Date(weekStart);
        dayDate.setDate(weekStart.getDate() + d);
        const dateKey = toLocalDateOnly(dayDate);
        days.push({
          dateKey,
          date: dayDate,
          value: pointsByDate.get(dateKey) ?? 0,
        });
      }

      weeks.push({ weekStart, days });
    }

    return { weeks, maxValue };
  }, [pointsByDate]);

  const weeklyGoalProgress = useMemo(() => {
    const goal = Math.max(0, Math.trunc(weeklyGoal));
    if (!goal) {
      return { goal, percent: 0 };
    }
    return {
      goal,
      percent: Math.min(100, Math.round((weekSummary.total / goal) * 100)),
    };
  }, [weekSummary.total, weeklyGoal]);

  const totals = useMemo(() => {
    let sum = 0;
    for (const entry of visibleReports) {
      sum += entry.totalPoints ?? 0;
    }
    const count = visibleReports.length;
    const average = count ? Math.round(sum / count) : 0;
    return { sum, count, average };
  }, [visibleReports]);

  const handleExport = async () => {
    setExporting(true);
    setError("");

    try {
      await exportReports(windowKey, isAdmin && selectedUsername !== "all" ? selectedUsername : undefined);
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setExporting(false);
    }
  };

  const handleClearMine = async () => {
    if (!confirm("سيتم حذف سجل التقارير الخاص بك. هل تريد المتابعة؟")) {
      return;
    }

    setError("");
    try {
      await clearAllData();
      await loadReports();
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    }
  };

  const heatCellClass = (value: number) => {
    if (value <= 0) {
      return "bg-muted/60 border-border/40";
    }

    const ratio = value / Math.max(1, heatmap.maxValue);
    if (ratio < 0.25) {
      return "bg-emerald-100 border-emerald-200";
    }
    if (ratio < 0.5) {
      return "bg-emerald-200 border-emerald-300";
    }
    if (ratio < 0.75) {
      return "bg-emerald-300 border-emerald-400";
    }
    return "bg-emerald-500 border-emerald-600";
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border border-border/50 p-5 bg-card shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-primary">
            <BarChart3 size={22} /> التقارير
          </h3>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void loadReports()}
              className="rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors"
            >
              <RefreshCw size={14} />
            </button>
            <button
              onClick={() => void handleExport()}
              disabled={exporting || loading}
              className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-sm hover:bg-muted transition-colors disabled:opacity-60"
            >
              <Download size={14} />
              {exporting ? "جارٍ التصدير..." : "تصدير Excel"}
            </button>
            <button
              onClick={() => void handleClearMine()}
              className="rounded-lg border border-destructive/30 text-destructive px-3 py-2 text-sm hover:bg-destructive/10 transition-colors"
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          {WINDOWS.map((entry) => (
            <button
              key={entry.key}
              onClick={() => setWindowKey(entry.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${
                windowKey === entry.key
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:bg-muted"
              }`}
            >
              {entry.label}
            </button>
          ))}
        </div>

        {isAdmin && (
          <div className="mb-4 flex items-center gap-2">
            <UserRound size={14} className="text-muted-foreground" />
            <select
              value={selectedUsername}
              onChange={(event) => setSelectedUsername(event.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="all">كل الحسابات</option>
              {usernames.map((username) => (
                <option key={username} value={username}>
                  {username}
                </option>
              ))}
            </select>
          </div>
        )}

        {error && (
          <div className="mb-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {loading ? (
          <div className="py-6">
            <div className="grid gap-3 sm:grid-cols-2">
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
            <div className="mt-4 space-y-3">
              {Array.from({ length: 5 }).map((_, idx) => (
                <Skeleton key={idx} className="h-20 w-full" />
              ))}
            </div>
          </div>
        ) : (
          <>
            <div className="grid gap-3 md:grid-cols-3">
              <article className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground">السلسلة</p>
                <div className="mt-2 flex items-center gap-2">
                  <Flame size={18} className="text-amber-600" />
                  <p className="text-2xl font-black text-foreground">{viewingSingleUser ? currentStreak : "--"}</p>
                  <span className="text-sm text-muted-foreground">يوم</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  أفضل سلسلة: <span className="font-semibold text-foreground">{viewingSingleUser ? bestStreak : "--"}</span> يوم
                </p>
              </article>

              <article className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                <p className="text-xs font-semibold tracking-wider text-muted-foreground">نقاط هذا الأسبوع</p>
                <div className="mt-2 flex items-center gap-2">
                  <Calendar size={18} className="text-primary" />
                  <p className="text-2xl font-black text-foreground">{weekSummary.total}</p>
                  <span className="text-sm text-muted-foreground">نقطة</span>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {toLocalDateOnly(weekSummary.start)} إلى {toLocalDateOnly(weekSummary.end)}
                </p>
              </article>

              {!isAdmin ? (
                <article className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-xs font-semibold tracking-wider text-muted-foreground">الهدف الأسبوعي</p>
                    <div className="flex items-center gap-2">
                      <Target size={16} className="text-emerald-700" />
                      <input
                        type="number"
                        min={1}
                        max={100000}
                        value={weeklyGoal}
                        onChange={(e) => setWeeklyGoal(Math.max(1, Math.trunc(Number(e.target.value || 1))))}
                        className="w-24 rounded-lg border border-border bg-background px-2 py-1 text-xs font-semibold text-foreground outline-none focus:ring-2 focus:ring-primary/30"
                        aria-label="الهدف الأسبوعي بالنقاط"
                      />
                    </div>
                  </div>

                  <div className="mt-3">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>
                        {weekSummary.total} / {weeklyGoalProgress.goal} نقطة
                      </span>
                      <span className="font-semibold text-foreground">{weeklyGoalProgress.percent}%</span>
                    </div>
                    <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-muted">
                      <div
                        className="h-full rounded-full bg-emerald-500"
                        style={{ width: `${weeklyGoalProgress.percent}%` }}
                      />
                    </div>
                  </div>
                </article>
              ) : (
                <article className="rounded-2xl border border-border/50 bg-muted/20 p-4">
                  <p className="text-xs font-semibold tracking-wider text-muted-foreground">ملخص الفترة</p>
                  <div className="mt-2 grid gap-1 text-sm text-foreground">
                    <div>
                      إجمالي النقاط: <span className="font-black">{totals.sum}</span>
                    </div>
                    <div>
                      متوسط النقاط: <span className="font-black">{totals.average}</span>
                    </div>
                    <div>
                      عدد التقارير: <span className="font-black">{totals.count}</span>
                    </div>
                  </div>
                </article>
              )}
            </div>

            <div className="mt-4 rounded-2xl border border-border/50 bg-muted/10 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="flex items-center gap-2 font-heading text-base font-bold text-foreground">
                  <Calendar size={18} className="text-primary" />
                  خريطة الإنجاز (آخر 12 أسبوع)
                </h4>
                {isAdmin && selectedUsername === "all" ? (
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    مجمّع لكل الحسابات
                  </span>
                ) : null}
              </div>

              <div className="mt-4 overflow-x-auto">
                <div className="inline-flex gap-1">
                  {heatmap.weeks.map((week) => (
                    <div key={week.weekStart.toISOString()} className="flex flex-col gap-1">
                      {week.days.map((day) => (
                        <div
                          key={day.dateKey}
                          title={`${day.dateKey} • ${day.value} نقطة`}
                          className={`h-3 w-3 rounded-sm border ${heatCellClass(day.value)}`}
                        />
                      ))}
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
                <span>أقل</span>
                {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                  <span
                    key={ratio}
                    className={`inline-block h-3 w-3 rounded-sm border ${
                      ratio === 0 ? "bg-muted/60 border-border/40" : ratio < 0.5 ? "bg-emerald-100 border-emerald-200" : ratio < 1 ? "bg-emerald-300 border-emerald-400" : "bg-emerald-500 border-emerald-600"
                    }`}
                  />
                ))}
                <span>أكثر</span>
              </div>
            </div>

            {visibleReports.length === 0 ? (
              <div className="text-center text-muted-foreground py-12 text-sm">لا توجد تقارير ضمن الفترة المحددة.</div>
            ) : (
              <div className="mt-4 space-y-3">
                {visibleReports.map((report, index) => (
                  <motion.div
                    key={`${report.username}-${report.date}-${index}`}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: index * 0.03 }}
                    className="rounded-xl border border-border/30 p-4 bg-muted/30"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
                      <div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(`${report.date}T00:00:00`).toLocaleDateString("ar", { weekday: "short" })}
                        </div>
                        <div className="font-bold text-sm">{report.date}</div>
                      </div>
                      <div className="text-sm font-semibold text-primary">{report.totalPoints} نقطة</div>
                    </div>

                    <div className="text-sm text-foreground mb-2">
                      {report.childName || "بدون اسم"}
                      {isAdmin && (
                        <span className="mr-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
                          {report.username}
                        </span>
                      )}
                    </div>

                    <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full gradient-gold"
                        initial={{ width: 0 }}
                        animate={{ width: `${(report.totalPoints / maxPoints) * 100}%` }}
                        transition={{ duration: 0.45 }}
                      />
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
};

export default ReportTab;
