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

/**
 * Số liệu tổng hợp cho hero khu Giảng dạy — MỘT request thay cho N request
 * `/classes/:id/report`. Phạm vi: các lớp người dùng thực sự phụ trách
 * (tự tạo, hoặc là thành viên với vai trò instructor/ta).
 */
export interface TeachOverviewDto {
  classCount: number;
  /** Học viên KHÁC NHAU trên tất cả các lớp — học 2 lớp vẫn tính là 1 người. */
  studentCount: number;
  /** Khóa học khác nhau đang được gán cho các lớp đó. */
  courseCount: number;
  /** Tiến độ trung bình 0..100: số bài đã hoàn thành / (học viên × bài đã mở gate). */
  avgProgress: number;
  /** Bài tập đã nộp mà chưa chấm (status = submitted). */
  pendingGradingCount: number;
  /** Số liệu từng lớp — đủ cho thẻ lớp ở sidebar tab Lớp học, khỏi gọi report từng lớp. */
  classes: TeachClassStatDto[];
}

/** Số liệu tóm tắt một lớp. Báo cáo đầy đủ vẫn ở `GET /classes/:id/report`. */
export interface TeachClassStatDto {
  classId: string;
  studentCount: number;
  /** 0..100, cùng định nghĩa với `ClassReportDto.courseCompletionRate`. */
  progress: number;
  pendingGradingCount: number;
}
