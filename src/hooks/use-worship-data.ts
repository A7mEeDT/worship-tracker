import { useState, useCallback, useEffect, useRef } from "react";
import {
  STORAGE_KEY,
  DUAS_KEY,
  NAME_KEY,
  DEFAULT_WIRDS,
  DEFAULT_ZIKRS,
  GOOGLE_SCRIPT_URL,
  type Wird,
  type Zikr,
  type PrayerData,
  type WirdChecked,
  type DayData,
} from "@/lib/worship-types";
import { logAction } from "@/lib/activity";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { useAuth } from "@/hooks/use-auth";
import type { ReportRecord, ReportWindow } from "@/types/reports";

interface WirdConfigResponse {
  wirds: Wird[];
}

interface ReportsResponse {
  reports: ReportRecord[];
}

function getLS<T>(key: string, fallback: T): T {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function getWirdKey(wird: Wird) {
  return `${wird.type}:${wird.name}`;
}

function normalizeWirdPoints(value: number) {
  const points = Math.trunc(Number(value));
  if (!Number.isFinite(points) || points <= 0) {
    return 1;
  }

  return Math.min(points, 100);
}

function normalizeWirdName(name: string) {
  return String(name).trim().slice(0, 100);
}

export function useWorshipData() {
  const { user } = useAuth();
  const canManageWirdConfig = user?.role === "admin" || user?.role === "primary_admin";

  const [date, setDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [childName, setChildName] = useState(() => localStorage.getItem(NAME_KEY) || "");

  const [prayers, setPrayers] = useState<Record<string, PrayerData>>({});

  const [wirds, setWirds] = useState<Wird[]>(DEFAULT_WIRDS);
  const [wirdChecked, setWirdChecked] = useState<Record<number, boolean>>({});
  const [wirdConfigLoading, setWirdConfigLoading] = useState(true);
  const [wirdConfigSaving, setWirdConfigSaving] = useState(false);
  const [wirdConfigError, setWirdConfigError] = useState("");

  const [quranValue, setQuranValue] = useState<number>(0);
  const [zikrs, setZikrs] = useState<Zikr[]>(() => getLS("zikr_list", DEFAULT_ZIKRS));
  const [zikrTotals, setZikrTotals] = useState<Record<number, number>>({});
  const [duas, setDuas] = useState<string[]>(() => getLS(DUAS_KEY, []));

  const [saving, setSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState("");

  const wirdsRef = useRef(wirds);
  const wirdCheckedRef = useRef(wirdChecked);

  useEffect(() => {
    wirdsRef.current = wirds;
  }, [wirds]);

  useEffect(() => {
    wirdCheckedRef.current = wirdChecked;
  }, [wirdChecked]);

  const applyWirdConfig = useCallback((nextWirds: Wird[]) => {
    const checkedByKey = new Map<string, boolean>();

    wirdsRef.current.forEach((entry, index) => {
      checkedByKey.set(getWirdKey(entry), Boolean(wirdCheckedRef.current[index]));
    });

    const remappedChecked: Record<number, boolean> = {};
    nextWirds.forEach((entry, index) => {
      remappedChecked[index] = checkedByKey.get(getWirdKey(entry)) || false;
    });

    setWirds(nextWirds);
    setWirdChecked(remappedChecked);
  }, []);

  const refreshWirdConfig = useCallback(async () => {
    setWirdConfigLoading(true);
    setWirdConfigError("");

    try {
      const response = await apiGet<WirdConfigResponse>("/api/wird-config");
      applyWirdConfig(response.wirds);
    } catch (error) {
      setWirdConfigError(error instanceof Error ? error.message : "Failed to load wird configuration.");
    } finally {
      setWirdConfigLoading(false);
    }
  }, [applyWirdConfig]);

  useEffect(() => {
    void refreshWirdConfig();
  }, [refreshWirdConfig]);

  const updateChildName = useCallback((name: string) => {
    setChildName(name);
    localStorage.setItem(NAME_KEY, name);
  }, []);

  const persistWirdConfig = useCallback(
    async (nextWirds: Wird[], auditAction: string) => {
      if (!canManageWirdConfig) {
        throw new Error("Only admin can modify wird configuration.");
      }

      const normalized = nextWirds.map((entry) => ({
        name: normalizeWirdName(entry.name),
        type: entry.type,
        val: normalizeWirdPoints(entry.val),
      }));

      setWirdConfigSaving(true);
      setWirdConfigError("");

      try {
        const response = await apiPut<WirdConfigResponse>("/api/wird-config", { wirds: normalized });
        applyWirdConfig(response.wirds);
        logAction(auditAction);
      } catch (error) {
        setWirdConfigError(error instanceof Error ? error.message : "Failed to update wird configuration.");
        throw error;
      } finally {
        setWirdConfigSaving(false);
      }
    },
    [canManageWirdConfig, applyWirdConfig],
  );

  const addWird = useCallback(
    async (name: string, type: "daily" | "weekly", val: number) => {
      const cleanedName = normalizeWirdName(name);
      if (!cleanedName) {
        return;
      }

      const next = [...wirdsRef.current, { name: cleanedName, type, val: normalizeWirdPoints(val) }];
      await persistWirdConfig(next, `admin_wird_add:${type}`);
    },
    [persistWirdConfig],
  );

  const deleteWird = useCallback(
    async (index: number) => {
      if (index < 0 || index >= wirdsRef.current.length) {
        return;
      }

      const next = wirdsRef.current.filter((_, i) => i !== index);
      await persistWirdConfig(next, `admin_wird_delete:${index}`);
    },
    [persistWirdConfig],
  );

  const updateWird = useCallback(
    async (index: number, updates: Partial<Pick<Wird, "name" | "type" | "val">>) => {
      const current = wirdsRef.current[index];
      if (!current) {
        return;
      }

      const next = [...wirdsRef.current];
      next[index] = {
        name: updates.name ? normalizeWirdName(updates.name) : current.name,
        type: updates.type ?? current.type,
        val: typeof updates.val === "number" ? normalizeWirdPoints(updates.val) : current.val,
      };

      await persistWirdConfig(next, `admin_wird_update:${index}`);
    },
    [persistWirdConfig],
  );

  const addZikr = useCallback((name: string, count: number) => {
    setZikrs((prev) => {
      const updated = [...prev, { name, count }];
      localStorage.setItem("zikr_list", JSON.stringify(updated));
      return updated;
    });
    logAction(`data_modified:add_zikr:${count}`);
  }, []);

  const deleteZikr = useCallback((index: number) => {
    setZikrs((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem("zikr_list", JSON.stringify(updated));
      return updated;
    });
    logAction(`data_modified:delete_zikr:${index}`);
  }, []);

  const addDua = useCallback((text: string) => {
    setDuas((prev) => {
      const updated = [...prev, text];
      localStorage.setItem(DUAS_KEY, JSON.stringify(updated));
      return updated;
    });
    logAction("data_modified:add_dua");
  }, []);

  const deleteDua = useCallback((index: number) => {
    setDuas((prev) => {
      const updated = prev.filter((_, i) => i !== index);
      localStorage.setItem(DUAS_KEY, JSON.stringify(updated));
      return updated;
    });
    logAction(`data_modified:delete_dua:${index}`);
  }, []);

  const calculatePoints = useCallback(() => {
    let total = 0;

    Object.values(prayers).forEach((p) => {
      if (p.jamaah) total += 8;
      else if (p.fard) total += 3;
      if (p.sunnah) total += 1;
      if (p.khatm) total += 1;
    });

    wirds.forEach((w, i) => {
      if (wirdChecked[i]) total += w.val;
    });

    total += quranValue;
    Object.values(zikrTotals).forEach((v) => {
      total += v;
    });

    return total;
  }, [prayers, wirds, wirdChecked, quranValue, zikrTotals]);

  const loadDay = useCallback(
    (day: string) => {
      setDate(day);
      const db = getLS<Record<string, DayData>>(STORAGE_KEY, {});
      const dayData = db[day];

      if (!dayData) {
        setPrayers({});
        setWirdChecked({});
        setQuranValue(0);
        setZikrTotals({});
        return;
      }

      if (dayData.childName) setChildName(dayData.childName);
      if (dayData.prayers) setPrayers(dayData.prayers);
      if (dayData.quran) setQuranValue(dayData.quran);

      const newWirdChecked: Record<number, boolean> = {};
      wirds.forEach((w, i) => {
        const list = w.type === "daily" ? dayData.wirds?.daily : dayData.wirds?.weekly;
        const found = list?.find((x) => x.name === w.name);
        newWirdChecked[i] = found?.checked || false;
      });
      setWirdChecked(newWirdChecked);

      if (dayData.zikrs) {
        const totals: Record<number, number> = {};
        zikrs.forEach((z, i) => {
          const saved = dayData.zikrs.find((s) => s.name === z.name);
          if (saved) totals[i] = saved.count;
        });
        setZikrTotals(totals);
      }
    },
    [wirds, zikrs],
  );

  const saveDay = useCallback(async () => {
    if (!childName.trim()) {
      setSaveStatus("Please enter a name first.");
      return;
    }

    setSaving(true);
    setSaveStatus("");

    const wirdData: { daily: WirdChecked[]; weekly: WirdChecked[] } = { daily: [], weekly: [] };
    wirds.forEach((w, i) => {
      const checked = wirdChecked[i] || false;
      const entry: WirdChecked = { name: w.name, checked, points: checked ? w.val : 0 };
      (w.type === "daily" ? wirdData.daily : wirdData.weekly).push(entry);
    });

    const zikrData = zikrs
      .map((z, i) => ({ name: z.name, count: zikrTotals[i] || 0 }))
      .filter((z) => z.count > 0);

    const dayData: DayData = {
      date,
      childName,
      prayers,
      wirds: wirdData,
      quran: quranValue,
      zikrs: zikrData,
      duas,
      totalPoints: calculatePoints(),
      savedAt: new Date().toISOString(),
    };

    const db = getLS<Record<string, DayData>>(STORAGE_KEY, {});
    db[date] = dayData;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
    logAction(`data_modified:save_day:${date}`);

    let backendSaved = true;
    let externalPosted = true;

    try {
      await apiPost("/api/reports", dayData);
    } catch {
      backendSaved = false;
    }

    try {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(dayData),
      });
    } catch {
      externalPosted = false;
    }

    if (backendSaved && externalPosted) {
      setSaveStatus("Report saved successfully.");
    } else if (backendSaved && !externalPosted) {
      setSaveStatus("Saved to system, but external sync failed.");
    } else {
      setSaveStatus("Saved locally, but failed to save to server.");
      logAction(`report_save_failed_backend:${date}`);
    }

    setSaving(false);
  }, [date, childName, prayers, wirds, wirdChecked, quranValue, zikrs, zikrTotals, duas, calculatePoints]);

  const getReports = useCallback(
    async (window: ReportWindow = "all", usernameFilter?: string) => {
      const query = new URLSearchParams();
      query.set("window", window);

      if (canManageWirdConfig && usernameFilter && usernameFilter !== "all") {
        query.set("username", usernameFilter);
      }

      const response = await apiGet<ReportsResponse>(`/api/reports?${query.toString()}`);
      return response.reports;
    },
    [canManageWirdConfig],
  );

  const exportReports = useCallback(
    async (window: ReportWindow = "all", usernameFilter?: string) => {
      const query = new URLSearchParams();
      query.set("window", window);

      if (canManageWirdConfig && usernameFilter && usernameFilter !== "all") {
        query.set("username", usernameFilter);
      }

      const response = await fetch(`/api/reports/export.csv?${query.toString()}`, {
        method: "GET",
        credentials: "include",
      });

      if (!response.ok) {
        throw new Error(`Export failed with ${response.status}`);
      }

      const blob = await response.blob();
      const downloadUrl = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = downloadUrl;
      link.download = `reports-${window}.csv`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(downloadUrl);
    },
    [canManageWirdConfig],
  );

  const clearAllData = useCallback(async () => {
    await apiDelete<void>("/api/reports");
    localStorage.removeItem(STORAGE_KEY);
    logAction("data_modified:clear_all_local_data");
  }, []);

  return {
    date,
    setDate: loadDay,
    childName,
    updateChildName,
    prayers,
    setPrayers,
    wirds,
    wirdChecked,
    setWirdChecked,
    addWird,
    deleteWird,
    updateWird,
    canManageWirdConfig,
    wirdConfigLoading,
    wirdConfigSaving,
    wirdConfigError,
    refreshWirdConfig,
    quranValue,
    setQuranValue,
    zikrs,
    zikrTotals,
    setZikrTotals,
    addZikr,
    deleteZikr,
    duas,
    addDua,
    deleteDua,
    calculatePoints,
    saveDay,
    saving,
    saveStatus,
    getReports,
    exportReports,
    clearAllData,
  };
}
