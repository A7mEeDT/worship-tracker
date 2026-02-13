import { useCallback, useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { Clock, HelpCircle, Send } from "lucide-react";
import { ApiError, apiGet, apiPost } from "@/lib/api";
import type { UserQuestionGroup } from "@/types/questions";

interface ActiveGroupResponse {
  serverTime: string;
  group: UserQuestionGroup | null;
  alreadySubmitted?: boolean;
}

export default function QuestionsTab() {
  const [group, setGroup] = useState<UserQuestionGroup | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [tick, setTick] = useState(0);

  const currentGroupId = group?.id ?? null;

  const loadActiveGroup = useCallback(async () => {
    setError("");
    try {
      const response = await apiGet<ActiveGroupResponse>("/api/questions/active");
      setGroup(response.group);
      const alreadySubmitted = Boolean(response.alreadySubmitted);

      const nextGroupId = response.group?.id ?? null;
      if (!nextGroupId) {
        setSubmitted(false);
        setAnswers({});
      } else if (nextGroupId !== currentGroupId) {
        // New group became active; reset answers.
        setSubmitted(alreadySubmitted);
        setAnswers({});
      } else {
        setSubmitted(alreadySubmitted);
      }
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "فشل تحميل الأسئلة.");
      setGroup(null);
      setSubmitted(false);
      setAnswers({});
    } finally {
      setLoading(false);
    }
  }, [currentGroupId]);

  useEffect(() => {
    void loadActiveGroup();
  }, [loadActiveGroup]);

  useEffect(() => {
    const id = setInterval(() => {
      void loadActiveGroup();
    }, 5000);
    return () => clearInterval(id);
  }, [loadActiveGroup]);

  useEffect(() => {
    if (!group?.closesAt || group.status !== "open") {
      return;
    }
    const id = setInterval(() => setTick((v) => v + 1), 1000);
    return () => clearInterval(id);
  }, [group?.closesAt, group?.status]);

  const remainingSeconds = useMemo(() => {
    void tick;
    if (!group?.closesAt || group.status !== "open") {
      return 0;
    }
    const end = new Date(group.closesAt).getTime();
    if (!Number.isFinite(end)) {
      return 0;
    }
    return Math.max(0, Math.ceil((end - Date.now()) / 1000));
  }, [group?.closesAt, group?.status, tick]);

  const canAnswer = group?.status === "open" && remainingSeconds > 0 && !submitted;

  const formatTime = (seconds: number) => {
    const s = Math.max(0, Math.trunc(seconds));
    const mm = Math.floor(s / 60);
    const ss = s % 60;
    return `${String(mm).padStart(2, "0")}:${String(ss).padStart(2, "0")}`;
  };

  const handleSubmit = async () => {
    if (!group || group.status !== "open") {
      return;
    }
    if (submitted) {
      return;
    }
    if (remainingSeconds <= 0) {
      setError("انتهى الوقت. لا يمكن إرسال الإجابات الآن.");
      void loadActiveGroup();
      return;
    }
    if (!confirm("سيتم إرسال إجاباتك الآن. هل أنت متأكد؟")) {
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      await apiPost(`/api/questions/${encodeURIComponent(group.id)}/submit`, {
        answers,
      });
      setSubmitted(true);
      void loadActiveGroup();
    } catch (requestError) {
      const apiError = requestError instanceof ApiError ? requestError : null;
      if (apiError?.code === "ALREADY_SUBMITTED") {
        setSubmitted(true);
        setError("تم إرسال إجاباتك بالفعل. لا يمكن الإرسال مرة أخرى.");
        void loadActiveGroup();
        return;
      }
      if (apiError?.code === "GROUP_CLOSED") {
        setError("تم إغلاق هذه المجموعة أو انتهى وقتها. لا يمكن إرسال الإجابات الآن.");
        void loadActiveGroup();
        return;
      }

      setError(apiError?.message ?? (requestError instanceof Error ? requestError.message : "فشل إرسال الإجابات."));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
      <div className="rounded-2xl border border-border/50 bg-card p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-heading text-xl font-bold text-primary">
              <HelpCircle size={22} /> الأسئلة
            </h3>
            <p className="mt-1 text-sm text-muted-foreground">
              عند تفعيل مجموعة أسئلة من المسؤول ستظهر هنا مع مؤقت تنازلي.
            </p>
          </div>

          {group?.status === "open" && (
            <div className="inline-flex items-center gap-2 rounded-xl border border-border bg-muted/40 px-3 py-2 text-sm">
              <Clock size={16} className="text-muted-foreground" />
              <span className="font-semibold">{formatTime(remainingSeconds)}</span>
            </div>
          )}
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-2 text-sm text-destructive">
            {error}
          </div>
        )}

        {group?.status === "open" && submitted && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm text-emerald-800">
            تم إرسال إجاباتك بالفعل. لا يمكن الإرسال مرة أخرى.
          </div>
        )}

        {group?.status === "open" && !submitted && remainingSeconds === 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2 text-sm text-amber-800">
            انتهى الوقت لهذه المجموعة. سيتم إغلاقها من جهة النظام.
          </div>
        )}

        {loading ? (
          <div className="py-10 text-center text-sm text-muted-foreground">جارٍ التحميل...</div>
        ) : !group ? (
          <div className="py-10 text-center text-sm text-muted-foreground">لا توجد مجموعة أسئلة نشطة الآن.</div>
        ) : group.status !== "open" ? (
          <div className="mt-6 rounded-2xl border border-border bg-muted/30 p-4 text-sm">
            <div className="font-semibold">الحالة: {group.status === "locked" ? "مقفل" : group.status === "closed" ? "منتهي" : "غير متاح"}</div>
            <div className="mt-1 text-muted-foreground">سيتم فتحها من قبل المسؤول عند الحاجة.</div>
          </div>
        ) : (
          <>
            <div className="mt-6 space-y-3">
              {group.questions.map((q, index) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="rounded-2xl border border-border/40 bg-muted/20 p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="font-semibold">{q.prompt}</div>
                    <div className="text-xs font-semibold text-primary">({q.points} درجة)</div>
                  </div>

                  {q.type === "text" ? (
                    <textarea
                      disabled={!canAnswer}
                      value={answers[q.id] ?? ""}
                      onChange={(e) => setAnswers((prev) => ({ ...prev, [q.id]: e.target.value }))}
                      placeholder="اكتب إجابتك هنا..."
                      className="mt-3 w-full min-h-[90px] rounded-xl border border-border bg-background px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-70"
                    />
                  ) : (
                    <div className="mt-3 grid gap-2">
                      {q.options.map((opt) => (
                        <label
                          key={opt.id}
                          className={`flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-sm transition-colors ${
                            (answers[q.id] ?? "") === opt.id
                              ? "border-primary bg-primary/10"
                              : "border-border bg-background hover:bg-muted/50"
                          } ${!canAnswer ? "cursor-not-allowed opacity-70" : ""}`}
                        >
                          <input
                            type="radio"
                            name={q.id}
                            value={opt.id}
                            disabled={!canAnswer}
                            checked={(answers[q.id] ?? "") === opt.id}
                            onChange={() => setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))}
                          />
                          <span>{opt.label}</span>
                        </label>
                      ))}
                    </div>
                  )}
                </motion.div>
              ))}
            </div>

            <button
              onClick={() => void handleSubmit()}
              disabled={!canAnswer || submitting}
              className="mt-5 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-primary px-4 py-4 text-base font-bold text-primary-foreground shadow-md transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={18} />
              {submitting ? "جارٍ الإرسال..." : submitted ? "تم الإرسال" : "إرسال الإجابات"}
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
