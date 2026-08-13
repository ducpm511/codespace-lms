// Hợp đồng Course/Section/Lesson. Chỉ type — decorator validate ở apps/api. docs/DESIGN.md §4.2.

export type CourseLanguageValue = 'scratch' | 'python' | 'other';
export type CourseLevelValue = 'beginner' | 'intermediate' | 'advanced';
export type CourseStatusValue = 'draft' | 'published' | 'archived';
export type LessonTypeValue = 'video' | 'article' | 'interactive' | 'coding' | 'quiz' | 'assignment';

export interface CourseSummary {
  id: string;
  slug: string;
  title: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  language: string;
  level: string;
  status: string;
  createdAt: string;
}

export interface LessonSummary {
  id: string;
  title: string;
  order: number;
  type: string;
  estimatedMinutes?: number | null;
}

export interface SectionWithLessons {
  id: string;
  title: string;
  order: number;
  lessons: LessonSummary[];
}

export interface CourseDetail extends CourseSummary {
  sections: SectionWithLessons[];
}

export interface CreateCourseRequest {
  slug: string;
  title: string;
  description?: string;
  language?: CourseLanguageValue;
  level?: CourseLevelValue;
}

export interface UpdateCourseRequest {
  title?: string;
  description?: string | null;
  thumbnailUrl?: string | null;
  language?: CourseLanguageValue;
  level?: CourseLevelValue;
}

export interface CreateSectionRequest {
  title: string;
  order?: number;
}

export interface CreateLessonRequest {
  title: string;
  order?: number;
  type?: LessonTypeValue;
  contentMd?: string;
  videoUrl?: string;
  estimatedMinutes?: number;
}

export interface UpdateLessonRequest {
  title?: string;
  order?: number;
  type?: LessonTypeValue;
  contentMd?: string | null;
  videoUrl?: string | null;
  estimatedMinutes?: number | null;
}
