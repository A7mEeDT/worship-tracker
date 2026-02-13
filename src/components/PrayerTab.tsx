import { motion } from "framer-motion";
import { PRAYERS, type PrayerData } from "@/lib/worship-types";

interface Props {
  prayers: Record<string, PrayerData>;
  setPrayers: React.Dispatch<React.SetStateAction<Record<string, PrayerData>>>;
  locked: boolean;
}

const PrayerTab = ({ prayers, setPrayers, locked }: Props) => {
  const baseKeys = new Set<keyof PrayerData>(["jamaahHome", "jamaahMosque", "qada", "fard"]);

  const normalizePrayer = (value?: Partial<PrayerData> | null): PrayerData => ({
    jamaahHome: Boolean(value?.jamaahHome),
    jamaahMosque: Boolean(value?.jamaahMosque ?? value?.jamaah),
    qada: Boolean(value?.qada),
    fard: Boolean(value?.fard),
    sunnah: Boolean(value?.sunnah),
    khatm: Boolean(value?.khatm),
  });

  const update = (name: string, field: keyof PrayerData, value: boolean) => {
    setPrayers(prev => {
      const current = normalizePrayer(prev[name]);
      const updated = { ...current };

      if (baseKeys.has(field)) {
        if (value) {
          // Enforce mutual exclusivity between base prayer types.
          for (const key of baseKeys) {
            updated[key] = false;
          }
        }
        updated[field] = value;
      } else {
        updated[field] = value;
      }

      return { ...prev, [name]: updated };
    });
  };

  const getPrayer = (name: string): PrayerData =>
    normalizePrayer(prayers[name]);

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
      <div className="grid grid-cols-[1.6fr_repeat(6,1fr)] gap-2 text-center text-[11px] font-semibold text-muted-foreground mb-2">
        <div>الصلاة</div>
        <div className="leading-tight">
          جماعة
          <br />
          بيت
        </div>
        <div className="leading-tight">
          جماعة
          <br />
          مسجد
        </div>
        <div>قضاء</div>
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
            className="grid grid-cols-[1.6fr_repeat(6,1fr)] gap-2 items-center rounded-xl bg-card border border-border/50 p-3 shadow-sm hover:shadow-md transition-shadow"
          >
            <div className="flex items-center gap-2 font-semibold text-sm">
              <span className="text-lg">{emojis[name]}</span>
              <span>{name}</span>
            </div>

            {/* Jamaah Home */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "jamaahHome", !p.jamaahHome)}
                className={`w-10 h-10 rounded-full border-2 transition-all duration-200 text-sm font-bold
                  ${p.jamaahHome
                    ? "bg-secondary border-secondary text-secondary-foreground scale-110 shadow-md"
                    : "border-border bg-muted hover:border-secondary/60"
                  }`}
              >
                {p.jamaahHome ? "✓" : "5"}
              </button>
            </div>

            {/* Jamaah Mosque */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "jamaahMosque", !p.jamaahMosque)}
                className={`w-10 h-10 rounded-full border-2 transition-all duration-200 text-sm font-bold
                  ${p.jamaahMosque
                    ? "bg-primary border-primary text-primary-foreground scale-110 shadow-md"
                    : "border-border bg-muted hover:border-primary/50"
                  }`}
              >
                {p.jamaahMosque ? "✓" : "8"}
              </button>
            </div>

            {/* Qada */}
            <div className="flex justify-center">
              <button
                disabled={locked}
                onClick={() => update(name, "qada", !p.qada)}
                className={`w-10 h-10 rounded-full border-2 transition-all duration-200 text-sm font-bold
                  ${p.qada
                    ? "bg-muted border-muted-foreground/40 text-foreground scale-110 shadow-md"
                    : "border-border bg-muted hover:border-foreground/25"
                  }`}
              >
                {p.qada ? "✓" : "1"}
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
