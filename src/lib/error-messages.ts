import { ApiError } from "@/lib/api";
import type { UserRole } from "@/types/auth";

const ARABIC_ERROR_BY_CODE: Record<string, string> = {
  TOTP_REQUIRED: "يلزم إدخال رمز المصادقة الثنائية للمشرف.",
  INVALID_OTP: "رمز المصادقة الثنائية يجب أن يكون 6 أرقام.",
  TOTP_INVALID: "رمز المصادقة الثنائية غير صحيح.",
  ADMIN_2FA_SETUP_REQUIRED: "يجب تفعيل المصادقة الثنائية للمشرف قبل الوصول للوحة الإدارة.",
  MFA_REQUIRED: "الجلسة الحالية غير مؤكدة بالمصادقة الثنائية. سجّل الخروج ثم أعد تسجيل الدخول برمز المصادقة.",
  AUTH_REQUIRED: "يلزم تسجيل الدخول أولاً.",
  FORBIDDEN: "ليس لديك صلاحية لتنفيذ هذا الإجراء.",
  MISSING_CREDENTIALS: "الرجاء إدخال اسم المستخدم وكلمة المرور.",
  INVALID_CREDENTIALS: "اسم المستخدم أو كلمة المرور غير صحيحة.",
  USER_NOT_AVAILABLE: "هذا الحساب غير نشط أو غير موجود.",
  MISSING_USERNAME: "اسم المستخدم مطلوب.",
  MISSING_PASSWORD: "كلمة المرور مطلوبة.",
  USER_EXISTS: "اسم المستخدم موجود بالفعل.",
  USER_NOT_FOUND: "المستخدم غير موجود.",
  WEAK_PASSWORD: "كلمة المرور ضعيفة. الرجاء اختيار كلمة مرور أقوى.",
  PRIMARY_ADMIN_PROTECTED: "لا يمكن حذف أو تعديل المدير الرئيسي.",
  INVALID_AUDIT_TYPE: "نوع السجل غير صحيح.",
  INVALID_WINDOW: "الفترة المحددة غير صحيحة.",
  INVALID_REPORT_WINDOW: "فترة التقارير غير صحيحة.",
  INVALID_REPORT_DATE: "صيغة التاريخ غير صحيحة.",
  MISSING_REPORT_OWNER: "مالك التقرير غير محدد.",
  MISSING_REQUESTER: "بيانات المستخدم غير مكتملة.",
  MISSING_TARGET_USERNAME: "اسم المستخدم المستهدف غير محدد.",
  MISSING_ACTION: "الإجراء مطلوب.",
  MISSING_PATH: "المسار مطلوب.",
  MISSING_GROUP_ID: "معرف المجموعة مطلوب.",
  GROUP_NOT_FOUND: "المجموعة غير موجودة.",
  INVALID_DURATION: "المدة غير صحيحة.",
  MISSING_QUESTIONS: "يجب إضافة سؤال واحد على الأقل.",
  INVALID_QUESTIONS: "الأسئلة غير صحيحة.",
  INVALID_QUESTION_PROMPT: "نص السؤال مطلوب.",
  INVALID_QUESTION_POINTS: "درجات السؤال غير صحيحة.",
  MISSING_OPTIONS: "خيارات السؤال مطلوبة.",
  MISSING_CORRECT: "الإجابة الصحيحة مطلوبة.",
  INVALID_REQUEST: "الطلب غير صالح.",
  GROUP_CLOSED: "تم إغلاق هذه المجموعة أو انتهى وقتها.",
  ALREADY_SUBMITTED: "تم إرسال إجاباتك بالفعل. لا يمكن الإرسال مرة أخرى.",
  GROUP_OPEN: "لا يمكن تنفيذ هذا الإجراء أثناء فتح المجموعة.",
};

export function getArabicErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.code && ARABIC_ERROR_BY_CODE[error.code]) {
      return ARABIC_ERROR_BY_CODE[error.code];
    }
    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "حدث خطأ غير متوقع.";
}

export function roleLabel(role: UserRole | string | null | undefined) {
  if (role === "primary_admin") {
    return "مدير رئيسي";
  }
  if (role === "admin") {
    return "مشرف";
  }
  if (role === "user") {
    return "مستخدم";
  }
  return role ? String(role) : "--";
}
