import { apiPost } from "./api";

function fireAndForget(promise: Promise<unknown>) {
  promise.catch(() => {
    // Activity logging should not block user actions.
  });
}

export function logAction(action: string) {
  const safeAction = action.trim();
  if (!safeAction) {
    return;
  }

  fireAndForget(apiPost("/api/activity/action", { action: safeAction }));
}

export function logPageAccess(path: string) {
  const safePath = path.trim();
  if (!safePath) {
    return;
  }

  fireAndForget(apiPost("/api/activity/page-access", { path: safePath }));
}
