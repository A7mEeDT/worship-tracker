import { logUserActivity } from "./activity-service.js";

export function createAuditService({ notificationService }) {
  async function recordUserAction({ username, action, ipAddress }) {
    const timestamp = new Date();

    await logUserActivity({
      username,
      action,
      ipAddress,
      timestamp,
    });

    await notificationService.recordActivityNotification({
      username,
      action,
      timestamp,
    });
  }

  return {
    recordUserAction,
  };
}
