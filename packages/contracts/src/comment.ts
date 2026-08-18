// Hợp đồng Thảo luận / Bình luận bài học FE <-> BE.

export interface LessonCommentDto {
  id: string;
  lessonId: string;
  classId: string;
  userId: string;
  userName: string;
  userAvatarUrl?: string | null;
  content: string;
  createdAt: string;
  updatedAt: string;
}

export interface CreateLessonCommentRequest {
  classId: string;
  content: string;
}
