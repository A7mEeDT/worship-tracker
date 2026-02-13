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

export type AuditLogType = "user_activity" | "admin_notifications";

export interface AuditLogEntryBase {
  id: string;
  type: AuditLogType;
  timestamp: string;
  username: string;
  action: string;
}

export interface UserActivityLogEntry extends AuditLogEntryBase {
  type: "user_activity";
  ipAddress: string;
}

export interface AdminNotificationLogEntry extends AuditLogEntryBase {
  type: "admin_notifications";
  admin: string;
}

export type AuditLogEntry = UserActivityLogEntry | AdminNotificationLogEntry;

export interface StorageFileInfo {
  name: string;
  sizeBytes: number;
  updatedAt: string;
}

export interface StorageOverview {
  dataDir: string;
  totalBytes: number;
  files: StorageFileInfo[];
  directories: string[];
  backups: {
    dirName: string;
    count: number;
    totalBytes: number;
    lastBackupAt: string | null;
    items: StorageFileInfo[];
  };
}

export interface BackupConfig {
  enabled: boolean;
  intervalMs: number;
  retentionDays: number;
}
