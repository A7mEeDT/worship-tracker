// Types and constants for the worship tracker

export const PRAYERS = ["الفجر", "الظهر", "العصر", "المغرب", "العشاء"] as const;
export type PrayerName = typeof PRAYERS[number];

export interface PrayerData {
  jamaah: boolean;
  fard: boolean;
  sunnah: boolean;
  khatm: boolean;
}

export interface Wird {
  name: string;
  type: "daily" | "weekly";
  val: number;
}

export interface WirdChecked {
  name: string;
  checked: boolean;
  points: number;
}

export interface Zikr {
  name: string;
  count: number;
}

export interface DayData {
  date: string;
  childName: string;
  prayers: Record<string, PrayerData>;
  wirds: { daily: WirdChecked[]; weekly: WirdChecked[] };
  quran: number;
  zikrs: Zikr[];
  duas: string[];
  totalPoints: number;
  savedAt: string;
}

export const DEFAULT_WIRDS: Wird[] = [
  { name: "أذكار الصباح", type: "daily", val: 2 },
  { name: "صلاة الضحى", type: "daily", val: 1 },
  { name: "الصلاة على النبي ﷺ", type: "daily", val: 2 },
  { name: "أذكار المساء", type: "daily", val: 2 },
  { name: "قيام الليل", type: "daily", val: 2 },
  { name: "صلاة الوتر", type: "daily", val: 2 },
  { name: "أذكار النوم", type: "daily", val: 2 },
  { name: "سورة الكهف", type: "weekly", val: 2 },
  { name: "صدقة", type: "weekly", val: 2 },
  { name: "صيام تطوع", type: "weekly", val: 5 },
];

export const DEFAULT_ZIKRS: Zikr[] = [
  { name: "سبحان الله", count: 33 },
];

export const STORAGE_KEY = "worship_v21_data";
export const CONFIG_KEY = "worship_config_v21";
export const ZIKR_KEY = "zikr_list";
export const DUAS_KEY = "duas_list";
export const NAME_KEY = "child_name";

export const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbxr7E9NakOJ5y3E-7hDAsckk7uav-INhqrzFWF4LMxlIrKofR52K1_ICo4tCiai4TGyww/exec";
