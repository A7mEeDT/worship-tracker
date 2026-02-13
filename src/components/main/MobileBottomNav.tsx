import type { ReactNode } from "react";

export type BottomNavItem<T extends string> = {
  id: T;
  label: string;
  icon: ReactNode;
};

interface Props<T extends string> {
  tabs: BottomNavItem<T>[];
  activeTab: T;
  onChange: (id: T) => void;
}

export default function MobileBottomNav<T extends string>({ tabs, activeTab, onChange }: Props<T>) {
  return (
    <nav
      aria-label="التنقل الرئيسي"
      className="sm:hidden fixed bottom-0 left-0 right-0 z-40 border-t border-border bg-background/95 backdrop-blur"
    >
      <div className="mx-auto max-w-3xl px-2 py-2">
        <div className="flex gap-2 overflow-x-auto scrollbar-none">
          {tabs.map((tab) => {
            const active = tab.id === activeTab;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                className={`inline-flex min-w-[96px] flex-col items-center justify-center gap-1 rounded-xl px-3 py-2 text-xs font-semibold transition ${
                  active
                    ? "bg-primary text-primary-foreground shadow"
                    : "border border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className="text-base leading-none">{tab.icon}</span>
                <span className="whitespace-nowrap">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </nav>
  );
}

