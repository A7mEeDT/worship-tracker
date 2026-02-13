import { useCallback, useEffect, useMemo, useState } from "react";
import { BellRing, PlugZap, RefreshCw } from "lucide-react";
import { apiGet } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";
import { Skeleton } from "@/components/ui/skeleton";
import type { AdminNotification } from "@/types/admin";

interface NotificationsResponse {
  notifications: AdminNotification[];
}

type ConnectionStatus = "connecting" | "connected" | "polling";

export default function AdminNotificationsPage() {
  const [notifications, setNotifications] = useState<AdminNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [connectionStatus, setConnectionStatus] = useState<ConnectionStatus>("connecting");

  const fetchNotifications = useCallback(async () => {
    try {
      const response = await apiGet<NotificationsResponse>("/api/admin/notifications?limit=120");
      setNotifications(response.notifications);
      setError("");
    } catch (requestError) {
      setError(getArabicErrorMessage(requestError));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    let socket: WebSocket | null = null;
    let pollInterval: ReturnType<typeof setInterval> | null = null;
    let reconnectTimeout: ReturnType<typeof setTimeout> | null = null;

    const clearTimers = () => {
      if (pollInterval) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
      if (reconnectTimeout) {
        clearTimeout(reconnectTimeout);
        reconnectTimeout = null;
      }
    };

    const startPolling = () => {
      if (pollInterval || !active) {
        return;
      }

      setConnectionStatus("polling");
      pollInterval = setInterval(() => {
        void fetchNotifications();
      }, 10000);
    };

    const connectSocket = () => {
      if (!active) {
        return;
      }

      setConnectionStatus("connecting");

      const protocol = window.location.protocol === "https:" ? "wss" : "ws";
      socket = new WebSocket(`${protocol}://${window.location.host}/ws/admin-notifications`);

      socket.onopen = () => {
        if (!active) {
          return;
        }
        setConnectionStatus("connected");
        if (pollInterval) {
          clearInterval(pollInterval);
          pollInterval = null;
        }
      };

      socket.onmessage = (event) => {
        if (!active) {
          return;
        }

        try {
          const payload = JSON.parse(event.data) as {
            type: string;
            notification?: AdminNotification;
          };

          if (payload.type !== "activity" || !payload.notification) {
            return;
          }

          setNotifications((current) => [payload.notification!, ...current].slice(0, 200));
        } catch {
          // Ignore malformed WebSocket messages.
        }
      };

      socket.onclose = () => {
        if (!active) {
          return;
        }

        startPolling();
        reconnectTimeout = setTimeout(connectSocket, 5000);
      };

      socket.onerror = () => {
        socket?.close();
      };
    };

    void fetchNotifications();
    connectSocket();

    return () => {
      active = false;
      clearTimers();
      socket?.close();
    };
  }, [fetchNotifications]);

  const statusLabel = useMemo(() => {
    if (connectionStatus === "connected") {
      return "اتصال مباشر";
    }

    if (connectionStatus === "polling") {
      return "وضع الاستطلاع";
    }

    return "جارٍ الاتصال";
  }, [connectionStatus]);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">إشعارات الإدارة</h1>
          <p className="text-sm text-slate-500">بث مباشر لكل أنشطة المستخدمين المسجلة عبر نظام التدقيق.</p>
        </div>
        <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold uppercase tracking-wider text-slate-600">
          <PlugZap size={14} />
          {statusLabel}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <button
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100"
          onClick={() => void fetchNotifications()}
          type="button"
        >
          <RefreshCw size={14} />
          تحديث
        </button>
      </div>

      {error && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200">
        <table className="min-w-full divide-y divide-slate-200 text-right text-sm">
          <thead className="bg-slate-50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">الوقت</th>
              <th className="px-4 py-3">المستخدم</th>
              <th className="px-4 py-3">الإجراء</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white">
            {loading ? (
              Array.from({ length: 8 }).map((_, idx) => (
                <tr key={idx}>
                  <td className="px-4 py-3" colSpan={3}>
                    <Skeleton className="h-6 w-full" />
                  </td>
                </tr>
              ))
            ) : notifications.length === 0 ? (
              <tr>
                <td className="px-4 py-6 text-slate-500" colSpan={3}>
                  <span className="inline-flex items-center gap-2">
                    <BellRing size={14} />
                    لا توجد إشعارات بعد.
                  </span>
                </td>
              </tr>
            ) : (
              notifications.map((notification, index) => (
                <tr key={notification.id} className={index === 0 ? "bg-cyan-50/50" : ""}>
                  <td className="whitespace-nowrap px-4 py-3 font-medium text-slate-700">{notification.timestamp}</td>
                  <td className="px-4 py-3 text-slate-800">{notification.username}</td>
                  <td className="px-4 py-3 text-slate-600">{notification.action}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
