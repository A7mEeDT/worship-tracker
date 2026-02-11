import type { DayData } from "@/lib/worship-types";

export type ReportWindow = "1d" | "7d" | "1w" | "1m" | "all";

export interface ReportRecord extends DayData {
  username: string;
}
