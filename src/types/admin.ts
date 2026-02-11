import type { UserRole } from "./auth";

export interface DashboardTimelinePoint {
  date: string;
  actions: number;
}

export interface DashboardPerUserPoint {
  username: string;
  actions: number;
}

export interface ManagedUser {
  username: string;
  role: UserRole;
  isActive: boolean;
}

export interface AdminNotification {
  id: string;
  timestamp: string;
  username: string;
  action: string;
  admin: string;
}
