import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import { useQuery } from '@tanstack/react-query';
import type { ScratchCheck, SubmissionDto } from '@lms/contracts';
import { getSubmissionAsset, getSubmissionJson } from './api';
import { analyzeScratchProject } from './rubric';
import { ScratchPlayer } from './ScratchPlayer';

/**
 * Màn chấm bài BlockSpace (T11.7 — ADR D6c): chạy ĐÚNG phiên bản đã nộp (đóng băng) bằng player + bảng tiêu chí
 * gợi ý GV đã chọn. Dự án của em vẫn private — mọi thứ lấy qua bài nộp (`/scratch/submissions/:id/...`).
 */
export function ScratchSubmissionReview({
  submission,
  checks,
}: {
  submission: SubmissionDto;
  checks: ScratchCheck[];
}): JSX.Element {
  const { t, i18n } = useTranslation();
  const json = useQuery({
    queryKey: ['scratch-submission-json', submission.id, submission.scratch?.versionSeq],
    queryFn: () => getSubmissionJson(submission.id),
    staleTime: Infinity, // phiên bản đóng băng không bao giờ đổi
  });
  // Player nạp lại khi `source` đổi — giữ cố định theo bài nộp, dùng lại project.json đã tải.
  const source = useMemo(
    () => ({
      json: async () => json.data ?? null,
      asset: (md5ext: string) => getSubmissionAsset(submission.id, md5ext),
    }),
    [json.data, submission.id],
  );
  const results = useMemo(
    () => (json.data ? analyzeScratchProject(JSON.parse(json.data), checks) : []),
    [json.data, checks],
  );
  const scratch = submission.scratch!;

  return (
    <div className="flex flex-col gap-3">
      <p className="text-muted m-0 text-xs">
        {t('assignments.scratchVersion', {
          title: scratch.projectTitle,
          seq: scratch.versionSeq,
          time: new Date(scratch.frozenAt).toLocaleString(i18n.language),
        })}
      </p>
      {json.data ? (
        <ScratchPlayer key={`${submission.id}-${scratch.versionSeq}`} source={source} title={scratch.projectTitle} />
      ) : (
        <p className="text-muted m-0 text-sm">{json.isError ? json.error.message : t('common.loading')}</p>
      )}
      {checks.length > 0 && json.data && (
        <div>
          <p className="text-muted m-0" style={{ fontSize: 11, marginBottom: 4 }}>
            {t('assignments.scratchHints')}
          </p>
          <ul className="m-0 flex list-none flex-col gap-1 p-0">
            {results.map((r) => (
              <li key={r.key} className="flex items-center gap-2 text-sm">
                <i
                  className={`ph ${r.passed ? 'ph-check-circle' : 'ph-circle-dashed'}`}
                  style={{ color: r.passed ? 'var(--cx-teal)' : 'var(--color-text-muted, #999)' }}
                  aria-hidden
                />
                <span>{t(`scratchChecks.${r.key}`)}</span>
                <span className="text-muted text-xs">
                  {r.key === 'minSprites'
                    ? t('assignments.scratchSprites', { count: r.count, min: r.min })
                    : r.passed
                      ? t('assignments.scratchBlocks', { count: r.count })
                      : t('assignments.scratchNone')}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
