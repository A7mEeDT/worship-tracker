export type QuestionType = "text" | "multiple_choice";

export interface QuestionOption {
  id: string;
  label: string;
}

export interface UserQuestion {
  id: string;
  type: QuestionType;
  prompt: string;
  points: number;
  options: QuestionOption[];
}

export interface UserQuestionGroup {
  id: string;
  title: string;
  status: "draft" | "open" | "locked" | "closed";
  durationSeconds: number;
  openedAt: string | null;
  closesAt: string | null;
  remainingSeconds: number;
  questions: UserQuestion[];
}

export interface AdminQuestion extends UserQuestion {
  correctAnswer: string;
}

export interface AdminQuestionGroup extends Omit<UserQuestionGroup, "questions"> {
  questions: AdminQuestion[];
  createdAt: string;
  updatedAt: string;
}

export interface SubmissionSummary {
  id: string;
  groupId: string;
  username: string;
  score: number;
  maxScore: number;
  durationMs: number;
  startedAt: string | null;
  submittedAt: string | null;
  answers: { questionId: string; answer: string }[];
  details: { questionId: string; correct: boolean; pointsEarned: number; pointsPossible: number }[];
}

