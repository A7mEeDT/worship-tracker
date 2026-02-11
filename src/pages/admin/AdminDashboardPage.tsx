import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, ChartColumnIncreasing, Users } from "lucide-react";
import { apiGet } from "@/lib/api";
import type { DashboardPerUserPoint, DashboardTimelinePoint } from "@/types/admin";

const WINDOW_OPTIONS = [7, 30, 90] as const;

interface TimelineResponse {
  timeline: DashboardTimelinePoint[];
}

interface DistributionResponse {
  distribution: DashboardPerUserPoint[];
}

export default function AdminDashboardPage() {
  const [windowDays, setWindowDays] = useState<(typeof WINDOW_OPTIONS)[number]>(30);
  const [timeline, setTimeline] = useState<DashboardTimelinePoint[]>([]);
  const [distribution, setDistribution] = useState<DashboardPerUserPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    void (async () => {
      setLoading(true);
      setError("");

      try {
        const [timelineResponse, distributionResponse] = await Promise.all([
          apiGet<TimelineResponse>(`/api/admin/analytics/timeline?days=${windowDays}`),
          apiGet<DistributionResponse>(`/api/admin/analytics/per-user?days=${windowDays}`),
        ]);

        if (!active) {
          return;
        }

        setTimeline(timelineResponse.timeline);
        setDistribution(distributionResponse.distribution);
      } catch (requestError) {
        if (!active) {
          return;
        }

        setError(requestError instanceof Error ? requestError.message : "Failed to load analytics");
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [windowDays]);

  const totalActions = useMemo(
    () => timeline.reduce((sum, point) => sum + point.actions, 0),
    [timeline],
  );

  const activeUsers = distribution.length;
  const topUser = distribution[0]?.username ?? "N/A";

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">Monitoring Dashboard</h1>
          <p className="text-sm text-slate-500">System-wide user activity trends and per-user action distribution.</p>
        </div>

        <div className="inline-flex rounded-xl border border-slate-200 bg-slate-50 p-1">
          {WINDOW_OPTIONS.map((days) => (
            <button
              key={days}
              onClick={() => setWindowDays(days)}
              className={`rounded-lg px-3 py-2 text-sm font-semibold transition ${
                windowDays === days ? "bg-slate-900 text-white shadow" : "text-slate-600 hover:bg-slate-200"
              }`}
            >
              Last {days}d
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Total actions</p>
          <div className="mt-3 flex items-center gap-2">
            <Activity size={18} className="text-cyan-700" />
            <p className="text-2xl font-black text-slate-900">{loading ? "--" : totalActions}</p>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Active users</p>
          <div className="mt-3 flex items-center gap-2">
            <Users size={18} className="text-cyan-700" />
            <p className="text-2xl font-black text-slate-900">{loading ? "--" : activeUsers}</p>
          </div>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs uppercase tracking-[0.18em] text-slate-500">Top actor</p>
          <div className="mt-3 flex items-center gap-2">
            <ChartColumnIncreasing size={18} className="text-cyan-700" />
            <p className="text-2xl font-black text-slate-900">{loading ? "--" : topUser}</p>
          </div>
        </article>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">User Activity Timeline</h2>
            <p className="text-sm text-slate-500">Actions recorded per day.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={timeline}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="actions"
                  stroke="#0f766e"
                  strokeWidth={2.5}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                  name="Actions"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-4">
          <div className="mb-3">
            <h2 className="text-lg font-bold text-slate-900">Per-User Activity Distribution</h2>
            <p className="text-sm text-slate-500">Total actions grouped by username.</p>
          </div>
          <div className="h-80">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={distribution}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" />
                <XAxis dataKey="username" tick={{ fontSize: 12 }} />
                <YAxis allowDecimals={false} tick={{ fontSize: 12 }} />
                <Tooltip />
                <Legend />
                <Bar dataKey="actions" fill="#0f766e" radius={[6, 6, 0, 0]} name="Actions" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </article>
      </div>
    </section>
  );
}
