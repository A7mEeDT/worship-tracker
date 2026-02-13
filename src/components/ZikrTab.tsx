import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Plus, RotateCcw } from "lucide-react";
import type { Zikr } from "@/lib/worship-types";

interface Props {
  zikrs: Zikr[];
  zikrTotals: Record<number, number>;
  setZikrTotals: React.Dispatch<React.SetStateAction<Record<number, number>>>;
  addZikr: (name: string, count: number) => void;
  deleteZikr: (i: number) => void;
  locked: boolean;
}

const ZikrTab = ({ zikrs, zikrTotals, setZikrTotals, addZikr, deleteZikr, locked }: Props) => {
  const [newName, setNewName] = useState("");
  const [newCount, setNewCount] = useState(33);
  const [remaining, setRemaining] = useState<Record<number, number>>({});
  const [animating, setAnimating] = useState<number | null>(null);

  const getRem = (i: number) => remaining[i] ?? zikrs[i]?.count ?? 0;

  const handleTap = (i: number) => {
    if (locked) return;
    const rem = getRem(i);
    if (rem > 0) {
      setRemaining(p => ({ ...p, [i]: rem - 1 }));
      setZikrTotals(p => ({ ...p, [i]: (p[i] || 0) + 1 }));
      setAnimating(i);
      setTimeout(() => setAnimating(null), 150);
    }
  };

  const resetCounter = (i: number) => {
    setRemaining(p => ({ ...p, [i]: zikrs[i].count }));
    setZikrTotals(p => ({ ...p, [i]: 0 }));
  };

  const handleAdd = () => {
    if (!newName.trim() || newCount < 1) return;
    addZikr(newName.trim(), newCount);
    setNewName("");
    setNewCount(33);
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl border border-border/50 bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
        ملاحظة: تبويب الأذكار للمتابعة والتحفيز فقط ولا يتم احتساب نقاطه ضمن مجموع النقاط الكلي.
      </div>

      {/* Add new */}
      <div className="flex flex-wrap gap-3 mb-2">
        <input
          value={newName}
          onChange={e => setNewName(e.target.value)}
          placeholder="ذكر جديد..."
          className="flex-[2] min-w-[140px] rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          onKeyDown={e => e.key === "Enter" && handleAdd()}
        />
        <input
          type="number"
          value={newCount}
          onChange={e => setNewCount(parseInt(e.target.value) || 0)}
          className="w-20 rounded-xl border border-border bg-background px-3 py-3 text-sm text-center focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={handleAdd}
          className="rounded-xl bg-primary px-5 py-3 text-primary-foreground text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus size={18} />
        </button>
      </div>

      <AnimatePresence>
        {zikrs.map((z, i) => {
          const rem = getRem(i);
          const total = zikrTotals[i] || 0;
          const done = rem === 0;
          const progress = z.count > 0 ? ((z.count - rem) / z.count) * 100 : 0;

          return (
            <motion.div
              key={`${z.name}-${i}`}
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className={`rounded-2xl border p-4 shadow-sm transition-all
                ${done ? "bg-success/10 border-success/30" : "bg-card border-border/50"}`}
            >
              <div className="flex items-center justify-between mb-3">
                <span className="font-semibold text-sm">{z.name}</span>
                <div className="flex items-center gap-2">
                  <button onClick={() => resetCounter(i)} className="text-muted-foreground hover:text-foreground transition-colors p-1">
                    <RotateCcw size={14} />
                  </button>
                  <button onClick={() => deleteZikr(i)} className="text-destructive/50 hover:text-destructive transition-colors p-1">
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Progress bar */}
              <div className="w-full h-1.5 rounded-full bg-muted mb-3 overflow-hidden">
                <motion.div
                  className={`h-full rounded-full ${done ? "bg-success" : "bg-primary"}`}
                  animate={{ width: `${progress}%` }}
                  transition={{ duration: 0.2 }}
                />
              </div>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    disabled={locked}
                    onClick={() => handleTap(i)}
                    className={`w-14 h-14 rounded-full font-bold text-lg transition-all duration-200 flex items-center justify-center
                      ${animating === i ? "animate-counter-pop" : ""}
                      ${done
                        ? "bg-success text-success-foreground shadow-md"
                        : "bg-primary text-primary-foreground hover:shadow-lg active:scale-95"
                      }`}
                  >
                    {rem}
                  </button>
                  <div className="text-xs text-muted-foreground">
                    المجموع: <span className="font-bold text-foreground">{total}</span>
                  </div>
                </div>
                {done && <span className="text-success font-semibold text-sm">✨ أحسنت!</span>}
              </div>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </motion.div>
  );
};

export default ZikrTab;
