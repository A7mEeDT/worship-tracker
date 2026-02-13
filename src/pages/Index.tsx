import { Suspense, lazy, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useWorshipData } from "@/hooks/use-worship-data";
import PrayerTab from "@/components/PrayerTab";
import { Save, AlertTriangle, Star } from "lucide-react";

type TabId = "prayer" | "azkar" | "quran" | "zikr" | "duas" | "questions" | "report";

const WirdTab = lazy(() => import("@/components/WirdTab"));
const QuranTab = lazy(() => import("@/components/QuranTab"));
const ZikrTab = lazy(() => import("@/components/ZikrTab"));
const DuaTab = lazy(() => import("@/components/DuaTab"));
const QuestionsTab = lazy(() => import("@/components/QuestionsTab"));
const ReportTab = lazy(() => import("@/components/ReportTab"));

const tabs: { id: TabId; label: string; icon: string }[] = [
  { id: "prayer", label: "الصلوات", icon: "🕌" },
  { id: "azkar", label: "الورد", icon: "📿" },
  { id: "quran", label: "القرآن", icon: "📖" },
  { id: "zikr", label: "الأذكار", icon: "🔢" },
  { id: "duas", label: "أدعية", icon: "🤲" },
  { id: "questions", label: "الأسئلة", icon: "❓" },
  { id: "report", label: "التقارير", icon: "📊" },
];

const Index = () => {
  const [activeTab, setActiveTab] = useState<TabId>("prayer");
  const data = useWorshipData();

  const today = new Date().toISOString().split("T")[0];
  const locked = data.date < today;
  const points = data.calculatePoints();

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-gold/10 pb-10">
      {/* Header */}
      <header className="gradient-header pattern-bg text-primary-foreground py-8 px-4 mb-6">
        <div className="max-w-3xl mx-auto text-center">
          <h1 className="font-heading text-3xl sm:text-4xl font-bold mb-2">📘 متتبع العبادات</h1>
          <p className="text-primary-foreground/70 text-sm">سجّل عباداتك اليومية واكسب النقاط</p>
        </div>
      </header>

      <div className="max-w-3xl mx-auto px-4">
        {/* Frame */}
        <div className="rounded-3xl border border-border/60 bg-card/70 p-5 shadow-xl backdrop-blur-sm sm:p-7">
        {/* Lock alert */}
        <AnimatePresence>
          {locked && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="flex items-center gap-2 rounded-xl bg-accent/15 border border-accent/30 text-accent-foreground px-4 py-3 mb-4 text-sm"
            >
              <AlertTriangle size={16} className="text-accent shrink-0" />
              وضع القراءة فقط: لا يمكن تعديل بيانات الأيام السابقة.
            </motion.div>
          )}
        </AnimatePresence>

        {/* Date & Name */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <span className="text-sm font-semibold shrink-0">📅</span>
            <input
              type="date"
              value={data.date}
              max={today}
              onChange={e => data.setDate(e.target.value)}
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
          <div className="flex-1 flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3 shadow-sm">
            <span className="text-sm font-semibold shrink-0">👤</span>
            <input
              type="text"
              value={data.childName}
              onChange={e => data.updateChildName(e.target.value)}
              placeholder="اكتب الاسم"
              className="flex-1 bg-transparent text-sm focus:outline-none"
            />
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 overflow-x-auto pb-2 mb-6 scrollbar-none">
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 whitespace-nowrap rounded-xl px-4 py-3 text-sm font-medium transition-all duration-200
                ${activeTab === tab.id
                  ? "bg-primary text-primary-foreground shadow-md scale-105"
                  : "bg-card border border-border text-muted-foreground hover:bg-muted"
                }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Tab content */}
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }}>
            <Suspense fallback={<div className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>}>
              {activeTab === "prayer" && (
                <PrayerTab prayers={data.prayers} setPrayers={data.setPrayers} locked={locked} />
              )}
              {activeTab === "azkar" && (
                <WirdTab
                  wirds={data.wirds} wirdChecked={data.wirdChecked}
                  setWirdChecked={data.setWirdChecked} addWird={data.addWird}
                  deleteWird={data.deleteWird} updateWird={data.updateWird}
                  canManageWirdConfig={data.canManageWirdConfig}
                  wirdConfigLoading={data.wirdConfigLoading}
                  wirdConfigSaving={data.wirdConfigSaving}
                  wirdConfigError={data.wirdConfigError}
                  refreshWirdConfig={data.refreshWirdConfig}
                  locked={locked}
                />
              )}
              {activeTab === "quran" && (
                <QuranTab quranValue={data.quranValue} setQuranValue={data.setQuranValue} locked={locked} />
              )}
              {activeTab === "zikr" && (
                <ZikrTab
                  zikrs={data.zikrs} zikrTotals={data.zikrTotals}
                  setZikrTotals={data.setZikrTotals} addZikr={data.addZikr}
                  deleteZikr={data.deleteZikr} locked={locked}
                />
              )}
              {activeTab === "duas" && (
                <DuaTab duas={data.duas} addDua={data.addDua} deleteDua={data.deleteDua} locked={locked} />
              )}
              {activeTab === "questions" && (
                <QuestionsTab />
              )}
              {activeTab === "report" && (
                <ReportTab
                  getReports={data.getReports}
                  exportReports={data.exportReports}
                  clearAllData={data.clearAllData}
                />
              )}
            </Suspense>
          </motion.div>
        </AnimatePresence>

        {/* Points */}
        <motion.div
          className="mt-6 rounded-2xl gradient-gold p-5 text-center shadow-lg"
          animate={{ scale: [1, 1.01, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <div className="flex items-center justify-center gap-2 text-accent-foreground">
            <Star size={20} className="fill-current" />
            <span className="font-heading text-xl font-bold">مجموع نقاط اليوم: {points}</span>
            <Star size={20} className="fill-current" />
          </div>
        </motion.div>

        {/* Save */}
        <button
          onClick={data.saveDay}
          disabled={data.saving || locked}
          className="w-full mt-4 rounded-2xl bg-success py-4 text-success-foreground font-bold text-lg hover:opacity-90 transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-md"
        >
          <Save size={20} />
          {data.saving ? "⏳ جارٍ الحفظ..." : "💾 حفظ إنجاز اليوم"}
        </button>

        {data.saveStatus && (
          <p className="text-center mt-3 text-sm text-muted-foreground">{data.saveStatus}</p>
        )}
        </div>
      </div>
    </div>
  );
};

export default Index;
