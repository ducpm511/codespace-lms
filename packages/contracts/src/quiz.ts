// Hợp đồng Quiz/Question/QuestionOption/QuizAttempt/QuizAnswer (autograde). Chỉ type. docs/DESIGN.md §4.6.
// INVARIANT: QuestionOption.isCorrect + Question.correctAnswer chỉ dùng cho authoring/grading surface;
// student-facing DTO (khi làm bài) KHÔNG BAO GIỜ chứa isCorrect/correctAnswer. Điểm chấm lại server-side.

export type QuizQuestionTypeValue =
  | 'single_choice'
  | 'multiple_choice'
  | 'true_false'
  | 'short_answer'
  | 'code_fill';

export type QuizAttemptStatusValue = 'in_progress' | 'submitted' | 'expired';

/** Câu hỏi choice-based dùng options; short_answer/code_fill dùng correctAnswer (author-only). */
export const CHOICE_QUESTION_TYPES: readonly QuizQuestionTypeValue[] = [
  'single_choice',
  'multiple_choice',
  'true_false',
];

export interface QuizSummary {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  timeLimitSec?: number | null;
  attemptsAllowed: number;
  passScore: number;
  shuffleQuestions: boolean;
  shuffleOptions: boolean;
  published: boolean;
  questionCount: number;
  maxScore: number; // Σ points của mọi câu hỏi
  createdAt: string;
}

// --- Student-facing (khi làm bài) — KHÔNG isCorrect/correctAnswer ---

export interface StudentQuizOptionDto {
  id: string;
  textMd: string;
  order: number;
}

export interface StudentQuizQuestionDto {
  id: string;
  type: QuizQuestionTypeValue;
  promptMd: string;
  points: number;
  order: number;
  options: StudentQuizOptionDto[]; // rỗng với short_answer/code_fill
}

/** Đề quiz cho học viên: KHÔNG lộ đáp án đúng. */
export interface QuizStudentDetail extends QuizSummary {
  questions: StudentQuizQuestionDto[];
}

// --- Author/admin (biên soạn) — CÓ isCorrect + correctAnswer ---

export interface AuthorQuizOptionDto {
  id: string;
  textMd: string;
  isCorrect: boolean;
  order: number;
}

export interface AuthorQuizQuestionDto {
  id: string;
  type: QuizQuestionTypeValue;
  promptMd: string;
  points: number;
  order: number;
  correctAnswer?: string | null; // dùng cho short_answer/code_fill
  options: AuthorQuizOptionDto[];
}

/** Chi tiết quiz cho GV/admin — CÓ đáp án. KHÔNG trả cho học viên đang làm bài. */
export interface QuizAuthorDetail extends QuizSummary {
  questions: AuthorQuizQuestionDto[];
}

// --- Authoring requests ---

export interface CreateQuizRequest {
  courseId: string;
  lessonId?: string;
  title: string;
  timeLimitSec?: number | null;
  attemptsAllowed?: number;
  passScore?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  published?: boolean;
}

export interface UpdateQuizRequest {
  title?: string;
  timeLimitSec?: number | null;
  attemptsAllowed?: number;
  passScore?: number;
  shuffleQuestions?: boolean;
  shuffleOptions?: boolean;
  published?: boolean;
}

export interface UpsertQuestionOptionRequest {
  id?: string;
  textMd: string;
  isCorrect: boolean;
  order?: number;
}

export interface UpsertQuestionRequest {
  id?: string;
  type: QuizQuestionTypeValue;
  promptMd: string;
  points?: number;
  order?: number;
  correctAnswer?: string | null;
  options?: UpsertQuestionOptionRequest[];
}

// --- Attempt / submit (làm bài) ---

export interface StartQuizAttemptRequest {
  classId: string;
}

export interface SubmitQuizAnswerInput {
  questionId: string;
  selectedOptionIds?: string[]; // choice-based
  textAnswer?: string; // short_answer/code_fill
}

/** Client gửi câu trả lời; điểm LUÔN do server chấm lại (không tin client). */
export interface SubmitQuizAttemptRequest {
  classId: string;
  answers: SubmitQuizAnswerInput[];
}

/** Kết quả từng câu SAU khi nộp: chỉ câu trả lời của học viên + điểm/đúng-sai. KHÔNG lộ đáp án đúng. */
export interface QuizAnswerResultDto {
  questionId: string;
  selectedOptionIds?: string[] | null;
  textAnswer?: string | null;
  awardedPoints: number;
  isCorrect: boolean;
}

export interface QuizAttemptDto {
  id: string;
  quizId: string;
  userId: string;
  classId?: string | null;
  status: QuizAttemptStatusValue;
  score?: number | null;
  maxScore: number;
  startedAt: string;
  submittedAt?: string | null;
  answers?: QuizAnswerResultDto[];
}
