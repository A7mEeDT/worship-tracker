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
import { getArabicErrorMessage } from "@/lib/error-messages";
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
  const [isDirty, setIsDirty] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  const baselineSnapshotRef = useRef<string>("");
  const initialLoadRef = useRef(false);

  const wirdsRef = useRef(wirds);
  const wirdCheckedRef = useRef(wirdChecked);

  useEffect(() => {
    wirdsRef.current = wirds;
  }, [wirds]);

  useEffect(() => {
    wirdCheckedRef.current = wirdChecked;
  }, [wirdChecked]);

  const normalizePrayer = (value?: Partial<PrayerData> | null): PrayerData => ({
    jamaahHome: Boolean(value?.jamaahHome),
    jamaahMosque: Boolean((value as PrayerData | undefined)?.jamaahMosque ?? (value as PrayerData | undefined)?.jamaah),
    qada: Boolean(value?.qada),
    fard: Boolean(value?.fard),
    sunnah: Boolean(value?.sunnah),
    khatm: Boolean(value?.khatm),
  });

  const prayerHasAnyValue = (value: PrayerData) =>
    Boolean(value.jamaahHome || value.jamaahMosque || value.qada || value.fard || value.sunnah || value.khatm);

  const buildSnapshotFromState = useCallback(() => {
    const normalizedPrayers = Object.entries(prayers)
      .map(([name, value]) => [name, normalizePrayer(value)] as const)
      .filter(([, value]) => prayerHasAnyValue(value))
      .sort(([a], [b]) => a.localeCompare(b));

    const checkedWirds = wirds
      .map((entry, index) => (wirdChecked[index] ? getWirdKey(entry) : null))
      .filter(Boolean)
      .sort((a, b) => String(a).localeCompare(String(b)));

    const zikrPairs = zikrs
      .map((entry, index) => {
        const count = Math.trunc(Number(zikrTotals[index] ?? 0));
        return count > 0 ? [entry.name, count] : null;
      })
      .filter(Boolean)
      .sort((a, b) => String(a?.[0]).localeCompare(String(b?.[0])));

    return JSON.stringify({
      childName: childName.trim(),
      prayers: normalizedPrayers,
      wirds: checkedWirds,
      quran: Math.trunc(Number(quranValue) || 0),
      zikrs: zikrPairs,
    });
  }, [childName, prayers, quranValue, wirdChecked, wirds, zikrs, zikrTotals]);

  const buildSnapshotFromDayData = useCallback((dayData: DayData | null) => {
    if (!dayData) {
      return JSON.stringify({
        childName: childName.trim(),
        prayers: [],
        wirds: [],
        quran: 0,
        zikrs: [],
      });
    }

    const normalizedPrayers = Object.entries(dayData.prayers ?? {})
      .map(([name, value]) => [name, normalizePrayer(value)] as const)
      .filter(([, value]) => prayerHasAnyValue(value))
      .sort(([a], [b]) => a.localeCompare(b));

    const checkedWirds = [
      ...(dayData.wirds?.daily ?? []).filter((entry) => entry.checked).map((entry) => `daily:${entry.name}`),
      ...(dayData.wirds?.weekly ?? []).filter((entry) => entry.checked).map((entry) => `weekly:${entry.name}`),
    ].sort((a, b) => a.localeCompare(b));

    const zikrPairs = (dayData.zikrs ?? [])
      .map((entry) => {
        const count = Math.trunc(Number(entry?.count ?? 0));
        return count > 0 ? [String(entry?.name ?? ""), count] : null;
      })
      .filter(Boolean)
      .sort((a, b) => String(a?.[0]).localeCompare(String(b?.[0])));

    return JSON.stringify({
      childName: String(dayData.childName ?? "").trim(),
      prayers: normalizedPrayers,
      wirds: checkedWirds,
      quran: Math.trunc(Number(dayData.quran) || 0),
      zikrs: zikrPairs,
    });
  }, [childName]);

  useEffect(() => {
    const snapshot = buildSnapshotFromState();
    if (!baselineSnapshotRef.current) {
      baselineSnapshotRef.current = snapshot;
      setIsDirty(false);
      return;
    }

    setIsDirty(snapshot !== baselineSnapshotRef.current);
  }, [buildSnapshotFromState, date]);

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
      setWirdConfigError(getArabicErrorMessage(error));
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
        setWirdConfigError(getArabicErrorMessage(error));
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
      const jamaahMosque = Boolean(p.jamaahMosque ?? p.jamaah);
      const jamaahHome = Boolean(p.jamaahHome);
      const qada = Boolean(p.qada);
      const fard = Boolean(p.fard);

      if (jamaahMosque) total += 8;
      else if (jamaahHome) total += 5;
      else if (fard) total += 3;
      else if (qada) total += 1;

      if (p.sunnah) total += 1;
      if (p.khatm) total += 1;
    });

    wirds.forEach((w, i) => {
      if (wirdChecked[i]) total += w.val;
    });

    total += quranValue;

    // NOTE: "الأذكار" tab is for spiritual tracking only and does not affect total points.

    return total;
  }, [prayers, wirds, wirdChecked, quranValue]);

  const loadDay = useCallback(
    (day: string) => {
      setDate(day);
      const db = getLS<Record<string, DayData>>(STORAGE_KEY, {});
      const dayData = db[day];

      baselineSnapshotRef.current = buildSnapshotFromDayData(dayData ?? null);
      setIsDirty(false);
      setLastSavedAt(dayData?.savedAt ?? null);
      setSaveStatus("");

      if (!dayData) {
        setPrayers({});
        setWirdChecked({});
        setQuranValue(0);
        setZikrTotals({});
        return;
      }

      if (dayData.childName) setChildName(dayData.childName);
      const normalized: Record<string, PrayerData> = {};
      Object.entries(dayData.prayers ?? {}).forEach(([name, state]) => {
        normalized[name] = {
          jamaahHome: Boolean((state as PrayerData | undefined)?.jamaahHome),
          jamaahMosque: Boolean((state as PrayerData | undefined)?.jamaahMosque ?? (state as PrayerData | undefined)?.jamaah),
          qada: Boolean((state as PrayerData | undefined)?.qada),
          fard: Boolean((state as PrayerData | undefined)?.fard),
          sunnah: Boolean((state as PrayerData | undefined)?.sunnah),
          khatm: Boolean((state as PrayerData | undefined)?.khatm),
        };
      });
      setPrayers(normalized);
      setQuranValue(dayData.quran ?? 0);

      const newWirdChecked: Record<number, boolean> = {};
      wirds.forEach((w, i) => {
        const list = w.type === "daily" ? dayData.wirds?.daily : dayData.wirds?.weekly;
        const found = list?.find((x) => x.name === w.name);
        newWirdChecked[i] = found?.checked || false;
      });
      setWirdChecked(newWirdChecked);

      const totals: Record<number, number> = {};
      zikrs.forEach((z, i) => {
        const saved = (dayData.zikrs ?? []).find((s) => s.name === z.name);
        if (saved) totals[i] = saved.count;
      });
      setZikrTotals(totals);
    },
    [wirds, zikrs, buildSnapshotFromDayData],
  );

  useEffect(() => {
    if (initialLoadRef.current) {
      return;
    }

    initialLoadRef.current = true;
    loadDay(date);
  }, [date, loadDay]);

  const saveDay = useCallback(async () => {
    if (!childName.trim()) {
      setSaveStatus("الرجاء إدخال الاسم أولاً.");
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
      setSaveStatus("تم حفظ التقرير بنجاح.");
    } else if (backendSaved && !externalPosted) {
      setSaveStatus("تم الحفظ في النظام، لكن فشلت المزامنة الخارجية.");
    } else {
      setSaveStatus("تم الحفظ محليًا، لكن فشل الحفظ على الخادم.");
      logAction(`report_save_failed_backend:${date}`);
    }

    baselineSnapshotRef.current = buildSnapshotFromState();
    setIsDirty(false);
    setLastSavedAt(dayData.savedAt);

    setSaving(false);
  }, [date, childName, prayers, wirds, wirdChecked, quranValue, zikrs, zikrTotals, duas, calculatePoints, buildSnapshotFromState]);

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
        throw new Error(`فشل التصدير: ${response.status}`);
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
    isDirty,
    lastSavedAt,
    getReports,
    exportReports,
    clearAllData,
  };
}
