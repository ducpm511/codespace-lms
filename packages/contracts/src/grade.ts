// Hợp đồng Sổ điểm (Gradebook). Chỉ type/interface — KHÔNG logic. docs/DESIGN.md §4.7, §5.2.

export type GradeSourceType = 'assignment' | 'quiz' | 'coding';

export interface GradeItemDto {
  id: string;
  classId: string;
  sourceType: GradeSourceType;
  sourceId: string;
  title: string;
  weight: number;
  maxScore: number;
}

export interface GradeEntryDto {
  id: string;
  gradeItemId: string;
  userId: string;
  score: number;
  computedAt: string;
}

export interface StudentGradebookRow {
  userId: string;
  userFullName: string;
  userEmail: string;
  grades: Record<string, number | null>; // gradeItemId -> score
  totalWeightedScore: number;
  completionRate: number;
}

export interface ClassGradebookDto {
  classId: string;
  items: GradeItemDto[];
  rows: StudentGradebookRow[];
}

export interface StudentOwnGradebookDto {
  classId: string;
  items: GradeItemDto[];
  grades: Record<string, number | null>;
  totalWeightedScore: number;
  completionRate: number;
}
