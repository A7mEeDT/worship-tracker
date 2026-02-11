import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Trash2, Heart } from "lucide-react";

interface Props {
  duas: string[];
  addDua: (text: string) => void;
  deleteDua: (i: number) => void;
  locked: boolean;
}

const DuaTab = ({ duas, addDua, deleteDua, locked }: Props) => {
  const [text, setText] = useState("");

  const handleAdd = () => {
    if (!text.trim()) return;
    addDua(text.trim());
    setText("");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      <div className="rounded-2xl border border-border/50 p-5 bg-card shadow-sm">
        <textarea
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder="اكتب دعاءك هنا..."
          disabled={locked}
          className="w-full min-h-[100px] rounded-xl border border-border bg-background p-4 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/30"
        />
        <button
          onClick={handleAdd}
          disabled={locked || !text.trim()}
          className="w-full mt-3 rounded-xl bg-primary py-3 text-primary-foreground font-semibold text-sm hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          🤲 حفظ الدعاء
        </button>
      </div>

      <AnimatePresence>
        {duas.map((d, i) => (
          <motion.div
            key={`${d}-${i}`}
            layout
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="flex items-start gap-3 rounded-2xl border border-border/50 p-4 bg-card shadow-sm"
          >
            <Heart size={16} className="text-accent mt-1 shrink-0" />
            <p className="flex-1 text-sm leading-relaxed">{d}</p>
            <button
              onClick={() => deleteDua(i)}
              className="text-destructive/50 hover:text-destructive transition-colors p-1 shrink-0"
            >
              <Trash2 size={14} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>

      {duas.length === 0 && (
        <div className="text-center text-muted-foreground py-8 text-sm">
          لم تُضف أي أدعية بعد
        </div>
      )}
    </motion.div>
  );
};

export default DuaTab;
