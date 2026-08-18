// Hợp đồng Class/ClassCourse/ClassMember/LessonGate/LessonProgress. docs/DESIGN.md §4.3.

import type { StudentLessonActivityDto } from './lesson-activity';

export type ClassStatusValue = 'planning' | 'active' | 'finished' | 'archived';
export type ClassMemberRoleValue = 'student' | 'ta' | 'instructor';
export type ProgressStatusValue = 'not_started' | 'in_progress' | 'completed';

export interface ClassSummary {
  id: string;
  name: string;
  code: string;
  description?: string | null;
  status: string;
  startDate?: string | null;
  endDate?: string | null;
  createdAt: string;
}

export interface ClassCourseDto {
  id: string;
  courseId: string;
  title: string;
  slug: string;
  order: number;
}

export interface ClassMemberDto {
  id: string;
  userId: string;
  email: string;
  fullName: string;
  roleInClass: string;
  status: string;
  joinedAt: string;
}

export interface ClassDetail extends ClassSummary {
  courses: ClassCourseDto[];
  members: ClassMemberDto[];
}

export interface CreateClassRequest {
  name: string;
  code: string;
  description?: string;
  startDate?: string;
  endDate?: string;
}

export interface UpdateClassRequest {
  name?: string;
  description?: string | null;
  status?: ClassStatusValue;
  startDate?: string | null;
  endDate?: string | null;
}

export interface AssignCourseRequest {
  courseId: string;
  order?: number;
}

export interface EnrollMemberRequest {
  userId: string;
  roleInClass?: ClassMemberRoleValue;
}

export interface SetLessonGateRequest {
  lessonId: string;
  isActive: boolean;
}

export interface LessonGateDto {
  lessonId: string;
  isActive: boolean;
  activatedAt?: string | null;
}

export interface LessonProgressDto {
  lessonId: string;
  status: string;
  completedAt?: string | null;
}

export interface UpdateProgressRequest {
  status: ProgressStatusValue;
}

/** Bài học học viên được phép học trong lớp (CHỈ bài đã mở gate — invariant domain), kèm tiến độ. */
export interface MyLessonDto {
  lessonId: string;
  title: string;
  type: string;
  courseTitle: string;
  sectionTitle: string;
  progressStatus: string;
  completedAt?: string | null;
  /** P7 — nội dung bài học dạng danh sách activity có thứ tự. */
  activities: StudentLessonActivityDto[];
  /** Legacy (bài soạn trước P7) — FE chỉ dùng khi `activities` rỗng. */
  contentMd?: string | null;
  videoUrl?: string | null;
}
