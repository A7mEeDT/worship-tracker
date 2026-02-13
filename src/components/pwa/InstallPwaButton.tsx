import { useEffect, useMemo, useState } from "react";
import { Download } from "lucide-react";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
};

function isIos() {
  if (typeof navigator === "undefined") {
    return false;
  }
  return /iphone|ipad|ipod/iu.test(navigator.userAgent);
}

function isStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  const isStandaloneDisplay = window.matchMedia?.("(display-mode: standalone)")?.matches ?? false;
  // iOS Safari specific.
  const nav = window.navigator as unknown as { standalone?: boolean };
  return Boolean(isStandaloneDisplay || nav.standalone);
}

export default function InstallPwaButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const canShow = useMemo(() => {
    if (dismissed) return false;
    if (isStandalone()) return false;
    return Boolean(deferredPrompt || isIos());
  }, [deferredPrompt, dismissed]);

  const handleInstall = async () => {
    setDismissed(false);

    if (deferredPrompt) {
      try {
        await deferredPrompt.prompt();
        const choice = await deferredPrompt.userChoice;
        if (choice.outcome === "accepted") {
          setDeferredPrompt(null);
        } else {
          setDismissed(true);
        }
      } catch {
        setDismissed(true);
      }
      return;
    }

    // iOS: show simple instructions (no native prompt).
    alert("على iPhone: افتح قائمة المشاركة (Share) ثم اختر (Add to Home Screen) لتثبيت التطبيق.");
  };

  if (!canShow) {
    return null;
  }

  return (
    <button
      type="button"
      onClick={() => void handleInstall()}
      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
    >
      <Download size={14} />
      تثبيت
    </button>
  );
}

