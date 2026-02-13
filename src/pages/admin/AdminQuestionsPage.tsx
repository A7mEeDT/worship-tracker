import { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Archive, Download, Lock, Plus, Save, Timer, Trash2, Unlock } from "lucide-react";
import { apiDelete, apiGet, apiPost, apiPut } from "@/lib/api";
import { getArabicErrorMessage } from "@/lib/error-messages";
import type { AdminQuestion, AdminQuestionGroup, QuestionOption, QuestionType, SubmissionSummary } from "@/types/questions";

interface GroupsResponse {
  groups: AdminQuestionGroup[];
}

interface SubmissionsResponse {
  submissions: SubmissionSummary[];
}

function defaultQuestion() {
  const question: AdminQuestion = {
    id: "",
    type: "text" as QuestionType,
    prompt: "",
    points: 1,
    options: [],
    correctAnswer: "",
  };
  return question;
}

export default function AdminQuestionsPage() {
  const [groups, setGroups] = useState<AdminQuestionGroup[]>([]);
  const [editingGroupId, setEditingGroupId] = useState<string>("");
  const [resultsGroupId, setResultsGroupId] = useState<string>("");
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);

  const [title, setTitle] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(10);
  const [questions, setQuestions] = useState<AdminQuestion[]>([defaultQuestion()]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [filterUsername, setFilterUsername] = useState("");
  const [sortMode, setSortMode] = useState<"newest" | "score_desc" | "score_asc" | "username">("newest");
  const [expandedSubmissionId, setExpandedSubmissionId] = useState<string>("");

  const loadGroups = useCallback(async () => {
    setError("");
    const response = await apiGet<GroupsResponse>("/api/admin/questions/groups");
    setGroups(response.groups);
  }, []);

  const loadSubmissions = useCallback(async (groupId: string) => {
    if (!groupId) {
      setSubmissions([]);
      return;
    }
    const response = await apiGet<SubmissionsResponse>(`/api/admin/questions/groups/${encodeURIComponent(groupId)}/submissions`);
    setSubmissions(response.submissions);
  }, []);

  useEffect(() => {
    setLoading(true);
    void loadGroups()
      .catch((err) => setError(getArabicErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [loadGroups]);

  useEffect(() => {
    void loadSubmissions(resultsGroupId).catch(() => null);
  }, [resultsGroupId, loadSubmissions]);

  const selectedGroup = useMemo(
    () => groups.find((g) => g.id === editingGroupId) ?? null,
    [groups, editingGroupId],
  );

  const beginCreate = () => {
    setEditingGroupId("");
    setTitle("");
    setDurationMinutes(10);
    setQuestions([defaultQuestion()]);
    setError("");
  };

  const beginEdit = (group: AdminQuestionGroup) => {
    setEditingGroupId(group.id);
    setTitle(group.title ?? "");
    setDurationMinutes(Math.max(1, Math.round((group.durationSeconds ?? 600) / 60)));
    setQuestions(group.questions.map((q) => ({ ...q, options: [...(q.options ?? [])] })));
    setError("");
  };

  const saveGroup = async () => {
    setSaving(true);
    setError("");

    try {
      const payload = {
        title,
        durationSeconds: Math.max(60, Math.trunc(durationMinutes) * 60),
        questions,
      };

      if (!editingGroupId) {
        if (!confirm("سيتم إنشاء مجموعة أسئلة جديدة. هل تريد المتابعة؟")) {
          return;
        }
        await apiPost("/api/admin/questions/groups", payload);
      } else {
        await apiPut(`/api/admin/questions/groups/${encodeURIComponent(editingGroupId)}`, payload);
      }

      await loadGroups();
    } catch (err) {
      setError(getArabicErrorMessage(err));
    } finally {
      setSaving(false);
    }
  };

  const openGroup = async (groupId: string) => {
    if (!confirm("فتح المجموعة سيجعلها متاحة للجميع وسيبدأ المؤقت. هل تريد المتابعة؟")) {
      return;
    }
    await apiPost(`/api/admin/questions/groups/${encodeURIComponent(groupId)}/open`);
    await loadGroups();
  };

  const lockGroup = async (groupId: string) => {
    if (!confirm("قفل المجموعة سيمنع جميع المستخدمين من الوصول إليها. هل تريد المتابعة؟")) {
      return;
    }
    await apiPost(`/api/admin/questions/groups/${encodeURIComponent(groupId)}/lock`);
    await loadGroups();
  };

  const clearResults = async (groupId: string) => {
    if (!confirm("سيتم حذف نتائج هذه المجموعة (الإجابات) مع إبقاء المجموعة نفسها. هل تريد المتابعة؟")) {
      return;
    }
    await apiDelete(`/api/admin/questions/groups/${encodeURIComponent(groupId)}/submissions`);
    await loadSubmissions(resultsGroupId === groupId ? groupId : resultsGroupId);
  };

  const archiveGroup = async (groupId: string) => {
    if (!confirm("سيتم أرشفة المجموعة ونتائجها لإزالة البيانات من الملفات النشطة (لتقليل الحجم). هل تريد المتابعة؟")) {
      return;
    }
    await apiPost(`/api/admin/questions/groups/${encodeURIComponent(groupId)}/archive`);
    if (editingGroupId === groupId) {
      beginCreate();
    }
    if (resultsGroupId === groupId) {
      setResultsGroupId("");
      setSubmissions([]);
      setExpandedSubmissionId("");
    }
    await loadGroups();
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("تحذير: سيتم حذف المجموعة ونتائجها نهائيًا من الملفات النشطة. هل أنت متأكد؟")) {
      return;
    }
    await apiDelete(`/api/admin/questions/groups/${encodeURIComponent(groupId)}`);
    if (editingGroupId === groupId) {
      beginCreate();
    }
    if (resultsGroupId === groupId) {
      setResultsGroupId("");
      setSubmissions([]);
      setExpandedSubmissionId("");
    }
    await loadGroups();
  };

  const exportCsv = async (groupId: string) => {
    setError("");
    const response = await fetch(`/api/admin/questions/groups/${encodeURIComponent(groupId)}/submissions/export.csv`, {
      method: "GET",
      credentials: "include",
    });
    if (!response.ok) {
      throw new Error(`فشل التصدير: ${response.status}`);
    }
    const blob = await response.blob();
    const downloadUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = `question-results-${groupId}.csv`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(downloadUrl);
  };

  const updateQuestion = (index: number, patch: Partial<AdminQuestion>) => {
    setQuestions((prev) => prev.map((q, i) => (i === index ? { ...q, ...patch } : q)));
  };

  const addOption = (qIndex: number) => {
    setQuestions((prev) =>
      prev.map((q, i) => {
        if (i !== qIndex) return q;
        const nextOptions: QuestionOption[] = [
          ...(q.options ?? []),
          { id: `o${(q.options?.length ?? 0) + 1}`, label: "" },
        ];
        return { ...q, options: nextOptions };
      }),
    );
  };

  const removeQuestion = (index: number) => {
    setQuestions((prev) => prev.filter((_, i) => i !== index));
  };

  const visibleSubmissions = useMemo(() => {
    const query = filterUsername.trim().toLowerCase();
    const filtered = query ? submissions.filter((s) => s.username.toLowerCase().includes(query)) : submissions;

    const sorted = [...filtered];
    sorted.sort((a, b) => {
      if (sortMode === "username") {
        return a.username.localeCompare(b.username);
      }
      if (sortMode === "score_desc") {
        return (b.score ?? 0) - (a.score ?? 0);
      }
      if (sortMode === "score_asc") {
        return (a.score ?? 0) - (b.score ?? 0);
      }
      return String(b.submittedAt ?? "").localeCompare(String(a.submittedAt ?? ""));
    });

    return sorted;
  }, [submissions, filterUsername, sortMode]);

  return (
    <div dir="rtl">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-slate-900">إدارة الأسئلة</h1>
          <p className="text-sm text-slate-600">إنشاء / تعديل / فتح / قفل مجموعات الأسئلة مع مؤقت ودرجات.</p>
        </div>
        <button
          onClick={beginCreate}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-800 hover:bg-slate-50"
        >
          <Plus size={16} />
          مجموعة جديدة
        </button>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
          {error}
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">مجموعات الأسئلة</h2>
            {loading && <span className="text-xs text-slate-500">تحميل...</span>}
          </div>

          {groups.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">لا توجد مجموعات بعد.</div>
          ) : (
            <div className="space-y-2">
              {groups.map((g) => (
                <div key={g.id} className="rounded-xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="truncate font-semibold text-slate-900">{g.title || "بدون عنوان"}</div>
                      <div className="mt-1 text-xs text-slate-600">
                        الحالة:{" "}
                        <span className="font-semibold">
                          {g.status === "open" ? "نشط" : g.status === "locked" ? "مقفل" : g.status === "closed" ? "منتهي" : "مسودة"}
                        </span>
                        {" • "}المدة: {Math.round((g.durationSeconds ?? 0) / 60)} دقيقة
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        onClick={() => beginEdit(g)}
                        className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-100"
                      >
                        تعديل
                      </button>
                      <button
                        onClick={() => void openGroup(g.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500"
                      >
                        <Unlock size={14} />
                        فتح
                      </button>
                      <button
                        onClick={() => void lockGroup(g.id)}
                        className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-semibold text-white hover:bg-slate-700"
                      >
                        <Lock size={14} />
                        قفل
                      </button>
                      <button
                        onClick={() => void clearResults(g.id)}
                        disabled={g.status === "open"}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        حذف النتائج
                      </button>
                      <button
                        onClick={() => void archiveGroup(g.id)}
                        disabled={g.status === "open"}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Archive size={14} />
                        أرشفة
                      </button>
                      <button
                        onClick={() => void deleteGroup(g.id)}
                        disabled={g.status === "open"}
                        className="inline-flex items-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-800 hover:bg-rose-100 disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                        حذف
                      </button>
                      <button
                        onClick={() => void exportCsv(g.id)}
                        className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                      >
                        <Download size={14} />
                        Excel
                      </button>
                      <button
                        onClick={() => {
                          setResultsGroupId(g.id);
                          setExpandedSubmissionId("");
                        }}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                          resultsGroupId === g.id ? "bg-cyan-700 text-white" : "bg-cyan-50 text-cyan-900 hover:bg-cyan-100"
                        }`}
                      >
                        النتائج
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold text-slate-900">
              {selectedGroup ? `تعديل: ${selectedGroup.title || selectedGroup.id}` : "إنشاء / تعديل"}
            </h2>
            <button
              onClick={() => void saveGroup()}
              disabled={saving}
              className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-700 disabled:opacity-70"
            >
              <Save size={16} />
              {saving ? "حفظ..." : "حفظ"}
            </button>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-semibold text-slate-600">عنوان المجموعة</label>
              <input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: اختبار الأسبوع"
                className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-600">المدة (دقيقة)</label>
              <div className="mt-1 flex items-center gap-2">
                <Timer size={16} className="text-slate-500" />
                <input
                  type="number"
                  min={1}
                  value={durationMinutes}
                  onChange={(e) => setDurationMinutes(parseInt(e.target.value) || 1)}
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                />
              </div>
            </div>
          </div>

          <div className="mt-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900">الأسئلة</h3>
              <button
                onClick={() => setQuestions((prev) => [...prev, defaultQuestion()])}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                إضافة سؤال
              </button>
            </div>

            <div className="mt-3 space-y-3">
              {questions.map((q, idx) => (
                <div key={idx} className="rounded-2xl border border-slate-200 p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-semibold text-slate-600">سؤال {idx + 1}</div>
                    <button
                      onClick={() => removeQuestion(idx)}
                      className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-1 text-xs font-semibold text-rose-800 hover:bg-rose-100"
                    >
                      حذف
                    </button>
                  </div>

                  <div className="mt-2 grid gap-3 sm:grid-cols-2">
                    <div className="sm:col-span-2">
                      <label className="text-xs font-semibold text-slate-600">نص السؤال</label>
                      <input
                        value={q.prompt}
                        onChange={(e) => updateQuestion(idx, { prompt: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                      />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">نوع الإجابة</label>
                      <select
                        value={q.type}
                        onChange={(e) => updateQuestion(idx, { type: e.target.value })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                      >
                        <option value="text">نص</option>
                        <option value="multiple_choice">اختيار من متعدد</option>
                      </select>
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600">الدرجة</label>
                      <input
                        type="number"
                        min={0}
                        value={q.points}
                        onChange={(e) => updateQuestion(idx, { points: parseInt(e.target.value) || 0 })}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                      />
                    </div>

                    {q.type === "multiple_choice" ? (
                      <>
                        <div className="sm:col-span-2">
                          <div className="flex items-center justify-between">
                            <label className="text-xs font-semibold text-slate-600">الخيارات</label>
                            <button
                              onClick={() => addOption(idx)}
                              className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                            >
                              إضافة خيار
                            </button>
                          </div>
                          <div className="mt-2 grid gap-2">
                            {(q.options ?? []).map((opt, optIndex: number) => (
                              <div key={`${idx}-${optIndex}`} className="grid grid-cols-[120px_1fr] gap-2">
                                <input
                                  value={opt.id}
                                  onChange={(e) => {
                                    const next = [...(q.options ?? [])];
                                    next[optIndex] = { ...next[optIndex], id: e.target.value };
                                    updateQuestion(idx, { options: next });
                                  }}
                                  placeholder="id"
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                                />
                                <input
                                  value={opt.label}
                                  onChange={(e) => {
                                    const next = [...(q.options ?? [])];
                                    next[optIndex] = { ...next[optIndex], label: e.target.value };
                                    updateQuestion(idx, { options: next });
                                  }}
                                  placeholder="نص الخيار"
                                  className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                        <div className="sm:col-span-2">
                          <label className="text-xs font-semibold text-slate-600">الإجابة الصحيحة</label>
                          <select
                            value={q.correctAnswer}
                            onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                          >
                            <option value="">اختر...</option>
                            {(q.options ?? []).map((opt) => (
                              <option key={opt.id} value={opt.id}>
                                {opt.id} - {opt.label}
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <label className="text-xs font-semibold text-slate-600">الإجابة الصحيحة (لا تظهر للمستخدم)</label>
                        <input
                          value={q.correctAnswer}
                          onChange={(e) => updateQuestion(idx, { correctAnswer: e.target.value })}
                          className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
                        />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-bold text-slate-900">نتائج المجموعة</h2>
          {resultsGroupId ? (
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={filterUsername}
                onChange={(e) => setFilterUsername(e.target.value)}
                placeholder="فلترة باسم المستخدم..."
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              />
              <select
                value={sortMode}
                onChange={(e) => setSortMode(e.target.value as "newest" | "score_desc" | "score_asc" | "username")}
                className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-cyan-200"
              >
                <option value="newest">الأحدث</option>
                <option value="score_desc">الأعلى درجة</option>
                <option value="score_asc">الأقل درجة</option>
                <option value="username">اسم المستخدم</option>
              </select>
            </div>
          ) : (
            <div className="text-xs text-slate-600">
              اختر مجموعة من اليسار ثم اضغط "النتائج".
            </div>
          )}
        </div>

        {resultsGroupId ? (
          visibleSubmissions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">لا توجد إجابات بعد.</div>
          ) : (
            <div className="mt-3 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-600">
                    <th className="text-right py-2 px-2">المستخدم</th>
                    <th className="text-right py-2 px-2">الدرجة</th>
                    <th className="text-right py-2 px-2">الوقت</th>
                    <th className="text-right py-2 px-2">تاريخ الإرسال</th>
                    <th className="text-right py-2 px-2">تفاصيل</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleSubmissions.map((s) => (
                    <Fragment key={s.id}>
                      <tr className="border-t border-slate-100">
                        <td className="py-2 px-2 font-semibold text-slate-900">{s.username}</td>
                        <td className="py-2 px-2">{s.score} / {s.maxScore}</td>
                        <td className="py-2 px-2">{Math.round((s.durationMs ?? 0) / 1000)}s</td>
                        <td className="py-2 px-2">{s.submittedAt ? new Date(s.submittedAt).toLocaleString() : "--"}</td>
                        <td className="py-2 px-2">
                          <button
                            onClick={() => setExpandedSubmissionId((current) => (current === s.id ? "" : s.id))}
                            className="rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                          >
                            {expandedSubmissionId === s.id ? "إخفاء" : "عرض"}
                          </button>
                        </td>
                      </tr>
                      {expandedSubmissionId === s.id && (
                        <tr className="border-t border-slate-100">
                          <td colSpan={5} className="bg-slate-50 px-3 py-3">
                            <div className="text-xs font-semibold text-slate-700 mb-2">الإجابات</div>
                            <div className="grid gap-2">
                              {s.answers.map((a) => {
                                const detail = s.details.find((d) => d.questionId === a.questionId);
                                const verdict = detail?.correct ? "صحيح" : "خطأ";
                                const pts = detail ? `${detail.pointsEarned}/${detail.pointsPossible}` : "--";
                                return (
                                  <div key={a.questionId} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                                    <div className="flex flex-wrap items-center justify-between gap-2">
                                      <div className="font-semibold text-slate-900">{a.questionId}</div>
                                      <div className="text-xs text-slate-600">
                                        <span className="font-semibold">{verdict}</span> • {pts}
                                      </div>
                                    </div>
                                    <div className="mt-1 text-slate-700 whitespace-pre-wrap break-words">{a.answer || "--"}</div>
                                  </div>
                                );
                              })}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )
        ) : (
          <div className="py-8 text-center text-sm text-slate-500">اختر مجموعة لعرض النتائج.</div>
        )}
      </div>
    </div>
  );
}
