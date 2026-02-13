export const Roles = Object.freeze({
  PRIMARY_ADMIN: "primary_admin",
  ADMIN: "admin",
  USER: "user",
});

export const ADMIN_ROLES = [Roles.PRIMARY_ADMIN, Roles.ADMIN];

export const AUTH_COOKIE_NAME = "session_token";

export const ALLOWED_DASHBOARD_WINDOWS = [7, 30, 90];

export const FILE_NAMES = Object.freeze({
  USERS: "users.txt",
  ADMIN_CREDENTIALS: "admin_credentials.txt",
  PRIMARY_ADMINS: "primary_admins.txt",
  DEACTIVATED_USERS: "deactivated_users.txt",
  WIRD_CONFIG: "wird_config.txt",
  WORSHIP_REPORTS: "worship_reports.txt",
  QUESTION_GROUPS: "question_groups.txt",
  QUESTION_GROUPS_ARCHIVE: "question_groups_archive.txt",
  QUESTION_SESSIONS: "question_sessions.txt",
  QUESTION_SESSIONS_ARCHIVE: "question_sessions_archive.txt",
  QUESTION_SUBMISSIONS: "question_submissions.txt",
  QUESTION_SUBMISSIONS_ARCHIVE: "question_submissions_archive.txt",
  USER_ACTIVITY_LOG: "user_activity_log.txt",
  ADMIN_NOTIFICATIONS: "admin_notifications.txt",
});
