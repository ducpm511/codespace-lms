// Hợp đồng Báo cáo/Thống kê lớp học FE <-> BE.

export interface GradeDistributionItem {
  range: string; // '0-49', '50-69', '70-84', '85-100'
  count: number;
}

export interface LessonProgressStatDto {
  lessonId: string;
  title: string;
  order: number;
  completedCount: number;
  completionRate: number; // 0..100
}

export interface ClassReportDto {
  classId: string;
  className: string;
  totalStudents: number;
  activeStudents: number;
  courseCompletionRate: number; // 0..100
  avgFinalScore: number;
  totalCertificatesIssued: number;
  gradeDistribution: GradeDistributionItem[];
  lessonProgressStats: LessonProgressStatDto[];
}
