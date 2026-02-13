import { useCallback, useEffect, useMemo, useState } from "react";
import { Download, Filter, RefreshCw, ScrollText } from "lucide-react";
import { apiGet } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";
import { formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { AuditLogEntry, AuditLogType } from "@/types/admin";

type WindowKey = "1d" | "7d" | "30d" | "all";

interface AuditResponse {
  entries: AuditLogEntry[];
}

const WINDOW_OPTIONS: { key: WindowKey; label: string; days: number | null }[] = [
  { key: "1d", label: "آخر 1 يوم", days: 1 },
  { key: "7d", label: "آخر 7 أيام", days: 7 },
  { key: "30d", label: "آخر 30 يوم", days: 30 },
  { key: "all", label: "كل الوقت", days: null },
];

function startOfDayLocal(date: Date) {
  const copy = new Date(date);
  copy.setHours(0, 0, 0, 0);
  return copy;
}

function subtractDaysLocal(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() - days);
  return copy;
}

export default function AdminAuditLogPage() {
  const [type, setType] = useState<AuditLogType>("user_activity");
  const [windowKey, setWindowKey] = useState<WindowKey>("7d");
  const [username, setUsername] = useState("");
  const [action, setAction] = useState("");

  const [entries, setEntries] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState("");

  const fromIso = useMemo(() => {
    const option = WINDOW_OPTIONS.find((o) => o.key === windowKey) ?? WINDOW_OPTIONS[1];
    if (!option.days) {
      return null;
    }
    const now = new Date();
    // Include today: last N days from the start of (today - (N-1))
    const from = startOfDayLocal(subtractDaysLocal(now, option.days - 1));
    return from.toISOString();
  }, [windowKey]);

  const fetchEntries = useCallback(
    async ({ reset }: { reset: boolean }) => {
      setError("");
      if (reset) {
        setLoading(true);
      } else {
        setLoadingMore(true);
      }

      try {
        const query = new URLSearchParams();
        query.set("type", type);
        query.set("limit", "200");
        query.set("scanLimit", "5000");
        if (username.trim()) {
          query.set("username", username.trim());
        }
        if (action.trim()) {
          query.set("action", action.trim());
        }
        if (fromIso) {
          query.set("from", fromIso);
        }
        if (!reset && entries.length) {
          const oldest = entries[entries.length - 1];
          query.set("before", oldest.timestamp);
        }

        const response = await apiGet<AuditResponse>(`/api/admin/audit/logs?${query.toString()}`);
        setEntries((current) => (reset ? response.entries : [...current, ...response.entries]));
      } catch (requestError) {
        setError(getArabicErrorMessage(requestError));
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [action, entries, fromIso, type, username],
  );

  useEffect(() => {
    void fetchEntries({ reset: true });
  }, [fetchEntries]);

  const handleExport = async () => {
    setError("");
    try {
      const query = new URLSearchParams();
      query.set("type", type);
      query.set("limit", "20000");
      query.set("scanLimit", "20000");
      if (username.trim()) {
        query.set("username", username.trim());
      }
      if (action.trim()) {
        query.set("action", action.trim());
      }
      if (fromIso) {
        query.set("from", fromIso);
      }

      const response = await fetch(`/api/admin/audit/logs/export.csv?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });
      if (!response.ok) {
        throw new Error(`Request failed with ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `audit-${type}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    }
  };

  const activeLabel = type === "user_activity" ? "سجل نشاط المستخدم" : "سجل إشعارات المشرف";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
            <ScrollText size={20} className="text-cyan-700" />
            سجل التدقيق
          </h1>
          <p className="text-sm text-slate-500">
            تتبع آخر الأحداث المسجلة (نشاط المستخدمين وإشعارات الإدارة) مع فلاتر وتصدير CSV.
          </p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700">
          <Filter size={14} />
          {activeLabel}
        </div>
      </div>

      <div className="grid gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-4 md:grid-cols-[220px_1fr_1fr_auto]">
        <label className="space-y-1 text-xs font-semibold text-slate-700">
          <span>نوع السجل</span>
          <select
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
            value={type}
            onChange={(e) => setType(e.target.value as AuditLogType)}
          >
            <option value="user_activity">نشاط المستخدم</option>
            <option value="admin_notifications">إشعارات المشرف</option>
          </select>
        </label>

        <label className="space-y-1 text-xs font-semibold text-slate-700">
          <span>اسم المستخدم (اختياري)</span>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="مثال: user123"
          />
        </label>

        <label className="space-y-1 text-xs font-semibold text-slate-700">
          <span>يحتوي الإجراء على (اختياري)</span>
          <input
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm outline-none ring-cyan-600/50 focus:ring-2"
            value={action}
            onChange={(e) => setAction(e.target.value)}
            placeholder="مثال: login أو page_access"
          />
        </label>

        <div className="flex items-end gap-2">
          <button
            type="button"
            onClick={() => void fetchEntries({ reset: true })}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700"
          >
            <RefreshCw size={16} />
            تحديث
          </button>
          <button
            type="button"
            onClick={() => void handleExport()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100"
          >
            <Download size={16} />
            تصدير CSV
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {WINDOW_OPTIONS.map((option) => (
          <button
            key={option.key}
            type="button"
            onClick={() => setWindowKey(option.key)}
            className={`rounded-full px-4 py-2 text-xs font-semibold transition ${
              windowKey === option.key
                ? "bg-slate-900 text-white shadow"
                : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-right text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">الوقت</th>
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">الإجراء</th>
              <th className="px-4 py-3">{type === "user_activity" ? "عنوان IP" : "المشرف"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              Array.from({ length: 10 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3" colSpan={4}>
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : entries.length === 0 ? (
              <tr>
                <td className="px-4 py-8 text-center text-slate-500" colSpan={4}>
                  لا توجد سجلات مطابقة للفلاتر الحالية.
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{formatDateTime(entry.timestamp)}</td>
                  <td className="px-4 py-3 font-semibold text-slate-900">{entry.username}</td>
                  <td className="px-4 py-3 text-slate-700">{entry.action}</td>
                  <td className="whitespace-nowrap px-4 py-3 text-slate-600">
                    {entry.type === "user_activity" ? entry.ipAddress : entry.admin}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {!loading && entries.length > 0 && (
        <div className="flex justify-center">
          <button
            type="button"
            onClick={() => void fetchEntries({ reset: false })}
            disabled={loadingMore}
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loadingMore ? "جارٍ التحميل..." : "تحميل المزيد"}
          </button>
        </div>
      )}
    </section>
  );
}

