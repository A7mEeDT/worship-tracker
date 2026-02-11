import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, Sun, CalendarDays, RefreshCw } from "lucide-react";
import type { Wird } from "@/lib/worship-types";

interface Props {
  wirds: Wird[];
  wirdChecked: Record<number, boolean>;
  setWirdChecked: React.Dispatch<React.SetStateAction<Record<number, boolean>>>;
  addWird: (name: string, type: "daily" | "weekly", val: number) => Promise<void>;
  deleteWird: (i: number) => Promise<void>;
  updateWird: (i: number, updates: Partial<Pick<Wird, "name" | "type" | "val">>) => Promise<void>;
  canManageWirdConfig: boolean;
  wirdConfigLoading: boolean;
  wirdConfigSaving: boolean;
  wirdConfigError: string;
  refreshWirdConfig: () => Promise<void>;
  locked: boolean;
}

const WirdTab = ({
  wirds,
  wirdChecked,
  setWirdChecked,
  addWird,
  deleteWird,
  updateWird,
  canManageWirdConfig,
  wirdConfigLoading,
  wirdConfigSaving,
  wirdConfigError,
  refreshWirdConfig,
  locked,
}: Props) => {
  const [newName, setNewName] = useState("");
  const [newType, setNewType] = useState<"daily" | "weekly">("daily");
  const [newPoints, setNewPoints] = useState(2);
  const [pointDrafts, setPointDrafts] = useState<Record<number, number>>({});
  const [actionError, setActionError] = useState("");

  const daily = wirds.map((w, i) => ({ ...w, index: i })).filter((w) => w.type === "daily");
  const weekly = wirds.map((w, i) => ({ ...w, index: i })).filter((w) => w.type === "weekly");

  const normalizePoints = (value: number) => {
    const points = Math.trunc(Number(value));
    if (!Number.isFinite(points) || points <= 0) return 1;
    return Math.min(points, 100);
  };

  const handleAdd = async () => {
    if (!canManageWirdConfig || !newName.trim()) return;
    setActionError("");

    try {
      await addWird(newName.trim(), newType, normalizePoints(newPoints));
      setNewName("");
      setNewPoints(newType === "daily" ? 2 : 5);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "فشل إضافة الورد");
    }
  };

  const handleDelete = async (index: number) => {
    if (!canManageWirdConfig) return;
    setActionError("");

    try {
      await deleteWird(index);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "فشل حذف الورد");
    }
  };

  const handleSavePoints = async (index: number, currentPoints: number) => {
    if (!canManageWirdConfig) return;
    setActionError("");

    const draftValue = pointDrafts[index];
    const points = typeof draftValue === "number" ? normalizePoints(draftValue) : currentPoints;

    try {
      await updateWird(index, { val: points });
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "فشل تحديث النقاط");
    }
  };

  const toggle = (i: number) => {
    if (locked) return;
    setWirdChecked((prev) => ({ ...prev, [i]: !prev[i] }));
  };

  const renderSection = (
    title: string,
    icon: React.ReactNode,
    items: (Wird & { index: number })[],
    color: string,
  ) => (
    <div className="rounded-2xl border border-border/50 p-5 bg-card shadow-sm">
      <h3 className={`flex items-center gap-2 font-heading text-lg font-bold mb-4 ${color}`}>
        {icon} {title}
      </h3>
      <div className="grid grid-cols-1 gap-3">
        <AnimatePresence>
          {items.map((w) => (
            <motion.div
              key={w.index}
              layout
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`flex flex-col gap-3 rounded-xl p-3 border transition-all
                ${wirdChecked[w.index]
                  ? "bg-primary/10 border-primary/30 shadow-sm"
                  : "bg-muted/50 border-border/30 hover:bg-muted"
                }`}
            >
              <div
                className="flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => toggle(w.index)}
              >
                <div className="flex items-center gap-3">
                  <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all text-xs
                    ${wirdChecked[w.index]
                      ? "bg-primary border-primary text-primary-foreground"
                      : "border-border"
                    }`}
                  >
                    {wirdChecked[w.index] && "✓"}
                  </div>
                  <span className="text-sm font-medium">{w.name}</span>
                </div>

                {!canManageWirdConfig && (
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {w.val} نقاط
                  </span>
                )}
              </div>

              {canManageWirdConfig && (
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={100}
                    value={pointDrafts[w.index] ?? w.val}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) =>
                      setPointDrafts((prev) => ({
                        ...prev,
                        [w.index]: Number(e.target.value),
                      }))
                    }
                    className="w-24 rounded-lg border border-border bg-background px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
                  />
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleSavePoints(w.index, w.val);
                    }}
                    disabled={wirdConfigSaving}
                    className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold hover:bg-muted disabled:opacity-60"
                  >
                    حفظ النقاط
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      void handleDelete(w.index);
                    }}
                    disabled={wirdConfigSaving}
                    className="text-destructive/70 hover:text-destructive transition-colors p-1 disabled:opacity-60"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/40 bg-card px-4 py-3">
        <div className="text-sm text-muted-foreground">
          {canManageWirdConfig
            ? "وضع المشرف: يمكنك تعديل إعدادات الورد للجميع."
            : "وضع القراءة: إعدادات الورد يقدر يعدلها المشرف فقط."}
        </div>
        <button
          onClick={() => void refreshWirdConfig()}
          disabled={wirdConfigLoading || wirdConfigSaving}
          className="inline-flex items-center gap-1 rounded-lg border border-border px-3 py-2 text-xs font-semibold hover:bg-muted disabled:opacity-60"
        >
          <RefreshCw size={14} />
          تحديث الإعدادات
        </button>
      </div>

      {(wirdConfigError || actionError) && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {actionError || wirdConfigError}
        </div>
      )}

      {renderSection("الورد اليومي", <Sun size={20} />, daily, "text-accent")}
      {renderSection("الورد الأسبوعي", <CalendarDays size={20} />, weekly, "text-primary")}

      {canManageWirdConfig && (
        <div className="rounded-2xl border border-dashed border-border p-5 bg-card/50">
          <h3 className="flex items-center gap-2 font-heading text-lg font-bold mb-4 text-muted-foreground">
            <Plus size={20} /> إضافة ورد جديد (لكل المستخدمين)
          </h3>
          <div className="flex flex-wrap gap-3">
            <input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="اسم الورد..."
              className="flex-[2] min-w-[180px] rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              onKeyDown={(e) => e.key === "Enter" && void handleAdd()}
            />
            <select
              value={newType}
              onChange={(e) => {
                const type = e.target.value as "daily" | "weekly";
                setNewType(type);
                setNewPoints(type === "daily" ? 2 : 5);
              }}
              className="rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            >
              <option value="daily">يومي</option>
              <option value="weekly">أسبوعي</option>
            </select>
            <input
              type="number"
              min={1}
              max={100}
              value={newPoints}
              onChange={(e) => setNewPoints(Number(e.target.value))}
              className="w-24 rounded-xl border border-border bg-background px-3 py-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
            <button
              onClick={() => void handleAdd()}
              disabled={wirdConfigSaving}
              className="rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-primary-foreground hover:opacity-90 transition-opacity disabled:opacity-60"
            >
              إضافة
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};

export default WirdTab;
