import { motion } from "framer-motion";
import { PRAYERS, type PrayerData } from "@/lib/worship-types";

interface Props {
  prayers: Record<string, PrayerData>;
  setPrayers: React.Dispatch<React.SetStateAction<Record<string, PrayerData>>>;
  locked: boolean;
}

const PrayerTab = ({ prayers, setPrayers, locked }: Props) => {
  const update = (name: string, field: keyof PrayerData, value: boolean) => {
    setPrayers(prev => {
      const current = prev[name] || { jamaah: false, fard: false, sunnah: false, khatm: false };
      const updated = { ...current };
      if (field === "jamaah" && value) {
        updated.jamaah = true;
        updated.fard = false;
      } else if (field === "fard" && value) {
        updated.fard = true;
        updated.jamaah = false;
      } else {
        updated[field] = value;
      }
      return { ...prev, [name]: updated };
    });
  };

  const getPrayer = (name: string): PrayerData =>
    prayers[name] || { jamaah: false, fard: false, sunnah: false, khatm: false };

  const emojis: Record<string, string> = {
    "الفجر": "🌅",
    "الظهر": "☀️",
    "العصر": "🌤️",
    "المغرب": "🌇",
    "العشاء": "🌙",
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-3"
    >
      {/* Header row */}
      <div className="grid grid-cols-5 gap-2 text-center text-xs font-semibold text-muted-foreground mb-2">
        <div>الصلاة</div>
        <div>جماعة</div>
        <div>فرد</div>
        <div>السنن</div>
        <div>ختام</div>
      </div>

      {PRAYERS.map((name, i) => {
        const p = getPrayer(name);
        return (
          <motion.div
            key={name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.06 }}
            className="grid grid-cols-5 gap-2 items-center rounded-xl bg-card border border-border/50 p-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <span className="text-lg">{emojis[name]}</span>
              <span>{name}</span>
            </div>

            {/* Jamaah */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "jamaah", !p.jamaah)}
                className={`w-10 h-10 rounded-full border-2 transition-all duration-200 text-sm font-bold
                  ${p.jamaah
                    ? "bg-primary border-primary text-primary-foreground scale-110 shadow-md"
                    : "border-border bg-muted hover:border-primary/50"
                  }`}
              >
                {p.jamaah ? "✓" : "8"}
              </button>
            </div>

            {/* Fard */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "fard", !p.fard)}
                className={`w-10 h-10 rounded-full border-2 transition-all duration-200 text-sm font-bold
                  ${p.fard
                    ? "bg-accent border-accent text-accent-foreground scale-110 shadow-md"
                    : "border-border bg-muted hover:border-accent/50"
                  }`}
              >
                {p.fard ? "✓" : "3"}
              </button>
            </div>

            {/* Sunnah */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "sunnah", !p.sunnah)}
                className={`w-9 h-9 rounded-lg border-2 transition-all duration-200 text-xs
                  ${p.sunnah
                    ? "bg-success border-success text-success-foreground"
                    : "border-border bg-muted hover:border-success/50"
                  }`}
              >
                {p.sunnah ? "✓" : "+1"}
              </button>
            </div>

            {/* Khatm */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "khatm", !p.khatm)}
                className={`w-9 h-9 rounded-lg border-2 transition-all duration-200 text-xs
                  ${p.khatm
                    ? "bg-success border-success text-success-foreground"
                    : "border-border bg-muted hover:border-success/50"
                  }`}
              >
                {p.khatm ? "✓" : "+1"}
              </button>
            </div>
          </motion.div>
        );
      })}
    </motion.div>
  );
};

export default PrayerTab;
