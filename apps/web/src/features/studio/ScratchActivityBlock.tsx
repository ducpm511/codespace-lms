import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { openScratchActivity } from './api';
import { studioKeys } from './hooks';

/**
 * Hoạt động BlockSpace trong bài học (T11.7): mỗi em một bản sao riêng của dự án mẫu. Bấm lần đầu tạo bản sao,
 * các lần sau mở lại đúng bản đó. Bản sao nằm trong "Dự án của tôi" như mọi dự án khác.
 */
export function ScratchActivityBlock({ activityId, classId }: { activityId: string; classId: string }): JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const open = useMutation({
    mutationFn: () => openScratchActivity(activityId, classId),
    onSuccess: ({ projectId, created }) => {
      if (created) void qc.invalidateQueries({ queryKey: studioKeys.mine });
      navigate(`/studio/${projectId}/edit`);
    },
  });

  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <p className="card-meta m-0">{t('activity.scratchStudentHint')}</p>
      <button
        type="button"
        className="btn btn-primary !rounded-full cx-press shrink-0"
        disabled={open.isPending}
        onClick={() => open.mutate()}
      >
        <i className="ph ph-puzzle-piece" aria-hidden /> {t('activity.scratchOpen')}
      </button>
      {open.error && (
        <p className="m-0 w-full text-sm" role="alert" style={{ color: '#f4a3a3' }}>
          {open.error.message}
        </p>
      )}
    </div>
  );
}
