import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/use-auth";
import { logPageAccess } from "@/lib/activity";

export default function PageActivityTracker() {
  const location = useLocation();
  const { user } = useAuth();
  const previousPath = useRef<string | null>(null);

  useEffect(() => {
    if (!user) {
      return;
    }

    if (previousPath.current === location.pathname) {
      return;
    }

    previousPath.current = location.pathname;
    logPageAccess(location.pathname);
  }, [location.pathname, user]);

  return null;
}
