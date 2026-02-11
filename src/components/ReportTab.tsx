import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Download, RefreshCw, Trash2, BarChart3, UserRound } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
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
  { key: "all", label: "All" },
];

const ReportTab = ({ getReports, exportReports, clearAllData }: Props) => {
  const { user } = useAuth();
  const isAdmin = user?.role === "admin" || user?.role === "primary_admin";

  const [windowKey, setWindowKey] = useState<ReportWindow>("1m");
  const [selectedUsername, setSelectedUsername] = useState("all");
  const [reports, setReports] = useState<ReportRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [error, setError] = useState("");

  const loadReports = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const next = await getReports(windowKey);
      setReports(next);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to load reports.");
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

  const handleExport = async () => {
    setExporting(true);
    setError("");

    try {
      await exportReports(windowKey, isAdmin && selectedUsername !== "all" ? selectedUsername : undefined);
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to export reports.");
    } finally {
      setExporting(false);
    }
  };

  const handleClearMine = async () => {
    if (!confirm("Delete your report history?")) {
      return;
    }

    setError("");
    try {
      await clearAllData();
      await loadReports();
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Failed to clear reports.");
    }
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
              {exporting ? "Exporting..." : "Excel"}
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
              <option value="all">All accounts</option>
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
          <div className="text-center text-muted-foreground py-12 text-sm">Loading reports...</div>
        ) : visibleReports.length === 0 ? (
          <div className="text-center text-muted-foreground py-12 text-sm">No reports found for selected window.</div>
        ) : (
          <div className="space-y-3">
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
                      {new Date(report.date).toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div className="font-bold text-sm">{report.date}</div>
                  </div>
                  <div className="text-sm font-semibold text-primary">{report.totalPoints} pts</div>
                </div>

                <div className="text-sm text-foreground mb-2">
                  {report.childName || "No name"}
                  {isAdmin && (
                    <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-xs text-primary">
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
      </div>
    </motion.div>
  );
};

export default ReportTab;
