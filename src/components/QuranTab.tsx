import { motion } from "framer-motion";
import { BookOpen } from "lucide-react";

interface Props {
  quranValue: number;
  setQuranValue: (v: number) => void;
  locked: boolean;
}

const options = [
  { label: "حزب", value: 3, desc: "3 نقاط" },
  { label: "جزء", value: 5, desc: "5 نقاط" },
  { label: "جزءان", value: 10, desc: "10 نقاط" },
];

const QuranTab = ({ quranValue, setQuranValue, locked }: Props) => {
  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border border-border/50 p-6 bg-card shadow-sm">
        <h3 className="flex items-center gap-2 font-heading text-xl font-bold mb-6 text-primary">
          <BookOpen size={22} /> ورد القرآن
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {options.map((opt, i) => (
            <motion.button
              key={opt.value}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              disabled={locked}
              onClick={() => setQuranValue(quranValue === opt.value ? 0 : opt.value)}
              className={`relative rounded-2xl border-2 p-6 text-center transition-all duration-300
                ${quranValue === opt.value
                  ? "border-primary bg-primary/10 shadow-lg scale-105"
                  : "border-border bg-muted/30 hover:border-primary/40 hover:bg-muted/50"
                }`}
            >
              <div className="text-3xl mb-2">📖</div>
              <div className="font-bold text-lg">{opt.label}</div>
              <div className={`text-sm mt-1 ${quranValue === opt.value ? "text-primary" : "text-muted-foreground"}`}>
                {opt.desc}
              </div>
              {quranValue === opt.value && (
                <motion.div
                  layoutId="quran-check"
                  className="absolute -top-2 -left-2 w-7 h-7 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-sm font-bold shadow-md"
                >
                  ✓
                </motion.div>
              )}
            </motion.button>
          ))}
        </div>
      </div>
    </motion.div>
  );
};

export default QuranTab;
