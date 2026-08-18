import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import type { CreateLessonCommentRequest, LessonCommentDto } from '@lms/contracts';
import { apiFetch } from '../../lib/api';

export function useLessonComments(lessonId?: string, classId?: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['lesson-comments', lessonId, classId],
    queryFn: () =>
      apiFetch<LessonCommentDto[]>(`/lessons/${lessonId}/comments?classId=${classId}`),
    enabled: Boolean(lessonId && classId),
  });

  const createComment = useMutation({
    mutationFn: (dto: CreateLessonCommentRequest) =>
      apiFetch<LessonCommentDto>(`/lessons/${lessonId}/comments`, {
        method: 'POST',
        body: JSON.stringify(dto),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['lesson-comments', lessonId, classId] });
    },
  });

  return {
    comments: query.data ?? [],
    isLoading: query.isLoading,
    createComment: createComment.mutateAsync,
    isSubmitting: createComment.isPending,
  };
}
