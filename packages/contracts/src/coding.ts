// Hợp đồng CodingProblem/TestCase/CodingSubmission (autograde). Chỉ type. docs/DESIGN.md §4.5, §6.
// Hidden tests chỉ dùng cho authoring/runner surface; student-facing DTO chỉ expose sample tests.

export type CodingLanguageValue = 'python';
export type CodingDifficultyValue = 'easy' | 'medium' | 'hard';
export type TestCaseKindValue = 'sample' | 'hidden';
export type CodingSubmissionStatusValue = 'queued' | 'running' | 'passed' | 'failed' | 'error';
export type TestCaseResultStatusValue = 'passed' | 'failed' | 'tle' | 'mle' | 're' | 'ce';

export interface SampleTestCaseDto {
  id: string;
  name?: string | null;
  stdin: string;
  expectedStdout: string;
  order: number;
}

export interface AuthorTestCaseDto extends SampleTestCaseDto {
  kind: TestCaseKindValue;
  weight: number;
}

export interface CodingProblemSummary {
  id: string;
  courseId: string;
  lessonId?: string | null;
  title: string;
  language: string;
  difficulty: string;
  maxScore: number;
  timeLimitMs: number;
  memoryLimitMb: number;
  createdAt: string;
}

/**
 * Tình hình làm bài của CHÍNH học viên trong một lớp. `bestScore` khớp cách sổ điểm tính (lấy lần cao
 * nhất), `passed` là đã từng đạt: nộp lại mà sai không làm mất hai giá trị này.
 */
export interface MyCodingStatusDto {
  attempts: number;
  passed: boolean;
  bestScore: number | null;
  latestStatus: string | null;
}

/** Danh sách bài cho học viên trong lớp; `myStatus` null = chưa nộp lần nào. */
export interface CodingProblemForClass extends CodingProblemSummary {
  myStatus: MyCodingStatusDto | null;
}

/** Student-facing problem detail: sample tests only, no hidden test metadata or solution code. */
export interface CodingProblemStudentDetail extends CodingProblemSummary {
  statementMd: string;
  starterCode?: string | null;
  sampleTests: SampleTestCaseDto[];
  myProgress: MyCodingProgressDto;
}

/** Teacher/admin authoring detail: may include hidden tests and solution code. Never return this to students. */
export interface CodingProblemAuthorDetail extends CodingProblemSummary {
  statementMd: string;
  starterCode?: string | null;
  solutionCode?: string | null;
  testCases: AuthorTestCaseDto[];
}

export interface CreateCodingProblemRequest {
  courseId: string;
  lessonId?: string;
  title: string;
  statementMd: string;
  language?: CodingLanguageValue;
  starterCode?: string;
  solutionCode?: string;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  difficulty?: CodingDifficultyValue;
  maxScore?: number;
}

export interface UpdateCodingProblemRequest {
  title?: string;
  statementMd?: string;
  starterCode?: string | null;
  solutionCode?: string | null;
  timeLimitMs?: number;
  memoryLimitMb?: number;
  difficulty?: CodingDifficultyValue;
  maxScore?: number;
}

export interface UpsertTestCaseRequest {
  id?: string;
  name?: string | null;
  stdin: string;
  expectedStdout: string;
  kind: TestCaseKindValue;
  weight?: number;
  order?: number;
}

/** Official submit request. Client sends source only; score/result is always computed server-side. */
export interface SubmitCodingRequest {
  classId: string;
  sourceCode: string;
  language?: CodingLanguageValue;
}

export interface TestCaseResultDto {
  id: string;
  testCaseId: string;
  name?: string | null;
  status: string;
  actualStdout?: string | null;
  runtimeMs?: number | null;
  order: number;
}

export interface CodingSubmissionDto {
  id: string;
  problemId: string;
  userId: string;
  classId?: string | null;
  language: string;
  status: string;
  score?: number | null;
  runtimeMs?: number | null;
  memoryKb?: number | null;
  submittedAt: string;
  results?: TestCaseResultDto[];
}

/** Bài nộp của chính học viên, kèm code để vào lại làm tiếp. Chỉ trả cho chủ bài nộp. */
export interface MyCodingSubmissionDto extends CodingSubmissionDto {
  sourceCode: string;
}

export interface MyCodingProgressDto extends MyCodingStatusDto {
  latest: MyCodingSubmissionDto | null;
}
