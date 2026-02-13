import { useCallback, useEffect, useMemo, useState } from "react";
import { HardDrive, RefreshCw, Save } from "lucide-react";
import { apiGet, apiPost } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";
import { formatBytes, formatDateTime } from "@/lib/format";
import { Skeleton } from "@/components/ui/skeleton";
import type { BackupConfig, StorageOverview } from "@/types/admin";

interface StorageResponse {
  overview: StorageOverview;
  backupConfig: BackupConfig;
}

interface RunBackupResponse {
  result: { backupDir: string; copied: number; pruned: number };
}

function formatInterval(intervalMs: number) {
  const ms = Number(intervalMs);
  if (!Number.isFinite(ms) || ms <= 0) {
    return "--";
  }
  const hours = Math.round(ms / (60 * 60 * 1000));
  return `${hours} ساعة`;
}

export default function AdminStoragePage() {
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [backupConfig, setBackupConfig] = useState<BackupConfig | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const response = await apiGet<StorageResponse>("/api/admin/system/storage");
      setOverview(response.overview);
      setBackupConfig(response.backupConfig);
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
      setOverview(null);
      setBackupConfig(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRunBackup = async () => {
    if (!confirm("سيتم إنشاء نسخة احتياطية جديدة الآن. هل تريد المتابعة؟")) {
      return;
    }

    setBusy(true);
    setError("");
    try {
      await apiPost<RunBackupResponse>("/api/admin/system/backups/run");
      await load();
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setBusy(false);
    }
  };

  const totalDataBytes = overview?.totalBytes ?? 0;
  const backups = overview?.backups;

  const latestBackupLabel = useMemo(() => formatDateTime(backups?.lastBackupAt ?? null), [backups?.lastBackupAt]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-black tracking-tight text-slate-900">
            <HardDrive size={20} className="text-cyan-700" />
            التخزين والنسخ الاحتياطي
          </h1>
          <p className="text-sm text-slate-500">
            متابعة حجم ملفات النظام على القرص، وحالة النسخ الاحتياطي (DATA_DIR/backups).
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
            onClick={() => void handleRunBackup()}
            disabled={busy}
            className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <Save size={16} />
            {busy ? "جارٍ التنفيذ..." : "نسخة احتياطية الآن"}
          </button>
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">حجم البيانات</p>
          <p className="mt-3 text-2xl font-black text-slate-900">
            {loading ? <Skeleton className="h-7 w-24" /> : formatBytes(totalDataBytes)}
          </p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">آخر نسخة احتياطية</p>
          <p className="mt-3 text-lg font-bold text-slate-900">{loading ? "--" : latestBackupLabel}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">سياسة النسخ الاحتياطي</p>
          <p className="mt-3 text-sm text-slate-700">
            {loading || !backupConfig ? (
              "--"
            ) : (
              <>
                <span className="font-semibold">{backupConfig.enabled ? "مفعّل" : "غير مفعّل"}</span> • كل{" "}
                <span className="font-semibold">{formatInterval(backupConfig.intervalMs)}</span> • الاحتفاظ{" "}
                <span className="font-semibold">{backupConfig.retentionDays} يوم</span>
              </>
            )}
          </p>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
            ملفات DATA_DIR
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-right text-sm">
              <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">الملف</th>
                  <th className="px-4 py-3">الحجم</th>
                  <th className="px-4 py-3">آخر تحديث</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3" colSpan={3}>
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !overview || overview.files.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                      لا توجد ملفات في DATA_DIR.
                    </td>
                  </tr>
                ) : (
                  overview.files.map((file) => (
                    <tr key={file.name}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{file.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatBytes(file.sizeBytes)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(file.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </article>

        <article className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
          <div className="border-b border-slate-200 bg-slate-50 px-4 py-3 text-sm font-bold text-slate-900">
            النسخ الاحتياطية
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-right text-sm">
              <thead className="bg-white text-xs uppercase tracking-wider text-slate-500">
                <tr>
                  <th className="px-4 py-3">المجلد</th>
                  <th className="px-4 py-3">الحجم</th>
                  <th className="px-4 py-3">آخر تحديث</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loading ? (
                  Array.from({ length: 8 }).map((_, idx) => (
                    <tr key={idx}>
                      <td className="px-4 py-3" colSpan={3}>
                        <Skeleton className="h-6 w-full" />
                      </td>
                    </tr>
                  ))
                ) : !overview || overview.backups.items.length === 0 ? (
                  <tr>
                    <td className="px-4 py-8 text-center text-slate-500" colSpan={3}>
                      لا توجد نسخ احتياطية بعد.
                    </td>
                  </tr>
                ) : (
                  overview.backups.items.map((backup) => (
                    <tr key={backup.name}>
                      <td className="px-4 py-3 font-semibold text-slate-900">{backup.name}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-700">{formatBytes(backup.sizeBytes)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-slate-600">{formatDateTime(backup.updatedAt)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {!loading && overview && (
            <div className="border-t border-slate-200 bg-slate-50 px-4 py-3 text-xs text-slate-700">
              الإجمالي: <span className="font-semibold">{overview.backups.count}</span> نسخة •{" "}
              <span className="font-semibold">{formatBytes(overview.backups.totalBytes)}</span>
            </div>
          )}
        </article>
      </div>
    </section>
  );
}

