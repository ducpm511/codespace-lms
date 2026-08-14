import type {
  CreateQuizRequest,
  Paginated,
  QuizAttemptDto,
  QuizAuthorDetail,
  QuizStudentDetail,
  QuizSummary,
  SubmitQuizAttemptRequest,
  UpdateQuizRequest,
  UpsertQuestionRequest,
} from '@lms/contracts';
import { apiFetch } from '../../lib/api';

// --- Authoring (GV/admin) ---

export const listQuizzes = (courseId?: string): Promise<Paginated<QuizSummary>> => {
  const q = courseId ? `&courseId=${encodeURIComponent(courseId)}` : '';
  return apiFetch<Paginated<QuizSummary>>(`/quizzes?page=1&pageSize=100${q}`);
};

export const getQuiz = (id: string): Promise<QuizAuthorDetail> =>
  apiFetch<QuizAuthorDetail>(`/quizzes/${encodeURIComponent(id)}`);

export const createQuiz = (body: CreateQuizRequest): Promise<QuizAuthorDetail> =>
  apiFetch<QuizAuthorDetail>('/quizzes', { method: 'POST', body: JSON.stringify(body) });

export const updateQuiz = (id: string, body: UpdateQuizRequest): Promise<QuizAuthorDetail> =>
  apiFetch<QuizAuthorDetail>(`/quizzes/${encodeURIComponent(id)}`, {
    method: 'PATCH',
    body: JSON.stringify(body),
  });

export const deleteQuiz = (id: string): Promise<void> =>
  apiFetch<void>(`/quizzes/${encodeURIComponent(id)}`, { method: 'DELETE' });

export const upsertQuestion = (
  quizId: string,
  body: UpsertQuestionRequest,
): Promise<QuizAuthorDetail> =>
  apiFetch<QuizAuthorDetail>(`/quizzes/${encodeURIComponent(quizId)}/questions`, {
    method: 'PUT',
    body: JSON.stringify(body),
  });

export const deleteQuestion = (quizId: string, questionId: string): Promise<QuizAuthorDetail> =>
  apiFetch<QuizAuthorDetail>(
    `/quizzes/${encodeURIComponent(quizId)}/questions/${encodeURIComponent(questionId)}`,
    { method: 'DELETE' },
  );

// --- Student (làm bài) — đề KHÔNG chứa đáp án; điểm chấm server-side ---

export const listQuizzesForClass = (classId: string): Promise<QuizSummary[]> =>
  apiFetch<QuizSummary[]>(`/quizzes/for-class/${encodeURIComponent(classId)}`);

export const getQuizAttempt = (id: string, classId: string): Promise<QuizStudentDetail> =>
  apiFetch<QuizStudentDetail>(
    `/quizzes/${encodeURIComponent(id)}/attempt?classId=${encodeURIComponent(classId)}`,
  );

export const submitQuizAttempt = (
  quizId: string,
  body: SubmitQuizAttemptRequest,
): Promise<QuizAttemptDto> =>
  apiFetch<QuizAttemptDto>(`/quizzes/${encodeURIComponent(quizId)}/attempts`, {
    method: 'POST',
    body: JSON.stringify(body),
  });

export const getAttemptResult = (attemptId: string): Promise<QuizAttemptDto> =>
  apiFetch<QuizAttemptDto>(`/quiz-attempts/${encodeURIComponent(attemptId)}`);
