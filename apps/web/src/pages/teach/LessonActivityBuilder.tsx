import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LESSON_ACTIVITY_TYPES, MAX_UPLOAD_BYTES } from '@lms/contracts';
import type { CreateLessonActivityRequest, LessonActivityDto, LessonActivityTypeValue } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import { useAssignments } from '../../features/assessments/hooks';
import { useCodingProblems } from '../../features/coding/hooks';
import { useQuizzes } from '../../features/quiz/hooks';
import {
  useAddActivity,
  useLessonDetail,
  useRemoveActivity,
  useReorderActivities,
  useUpdateActivity,
  useUploadFile,
} from '../../features/lesson-activities/hooks';
import { MarkdownBlock, PdfBlock, VideoBlock } from '../../features/lesson-activities/ActivityBlocks';
import { activityMeta } from '../../features/lesson-activities/activityMeta';

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}

/**
 * Trình soạn nội dung bài học (P7): danh sách activity có thứ tự — thêm / sửa / xoá / đổi thứ tự.
 * Thay cho form "chỉ có tiêu đề" trước đây.
 */
export function LessonActivityBuilder({
  courseId,
  sectionId,
  lessonId,
  lessonTitle,
  onClose,
}: {
  courseId: string;
  sectionId: string;
  lessonId: string;
  lessonTitle: string;
  onClose: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const detail = useLessonDetail(courseId, sectionId, lessonId);
  const remove = useRemoveActivity(courseId, sectionId, lessonId);
  const reorder = useReorderActivities(courseId, sectionId, lessonId);
  const [editingId, setEditingId] = useState<string | null>(null);

  const activities = detail.data?.activities ?? [];

  const move = (index: number, delta: number) => {
    const next = [...activities];
    const target = index + delta;
    if (target < 0 || target >= next.length) return;
    [next[index], next[target]] = [next[target], next[index]];
    reorder.mutate(next.map((a) => a.id));
  };

  return (
    <div className="card gap-4" style={{ borderRadius: 'var(--cx-radius)' }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-accent-300)' }}>
            {t('activity.builderKicker')}
          </p>
          <h3 className="cx-display text-xl">{lessonTitle}</h3>
          <p className="card-meta">{t('activity.count', { count: activities.length })}</p>
        </div>
        <button type="button" className="btn btn-ghost cx-press" onClick={onClose}>
          <i className="ph ph-x" aria-hidden /> {t('common.close')}
        </button>
      </div>

      {detail.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {detail.isError && <p className="text-sm text-red-400">{errMsg(detail.error)}</p>}
      {reorder.isError && <p className="text-sm text-red-400">{errMsg(reorder.error)}</p>}
      {remove.isError && <p className="text-sm text-red-400">{errMsg(remove.error)}</p>}

      {detail.data && activities.length === 0 && (
        <p
          className="text-muted rounded-lg border border-dashed px-4 py-8 text-center text-sm"
          style={{ borderColor: 'var(--color-divider)' }}
        >
          {t('activity.empty')}
        </p>
      )}

      <ul className="space-y-3">
        {activities.map((a, i) => (
          <li key={a.id}>
            {editingId === a.id ? (
              <ActivityEditor
                courseId={courseId}
                sectionId={sectionId}
                lessonId={lessonId}
                activity={a}
                onDone={() => setEditingId(null)}
              />
            ) : (
              <ActivityRow
                activity={a}
                index={i}
                total={activities.length}
                onEdit={() => setEditingId(a.id)}
                onRemove={() => {
                  if (confirm(t('activity.confirmRemove', { title: a.title || t(`activity.type_${a.type}`) }))) {
                    remove.mutate(a.id);
                  }
                }}
                onMove={(delta) => move(i, delta)}
                busy={reorder.isPending || remove.isPending}
              />
            )}
          </li>
        ))}
      </ul>

      <AddActivityForm courseId={courseId} sectionId={sectionId} lessonId={lessonId} />
    </div>
  );
}

/* ── Một dòng activity (xem nhanh + hành động) ───────────────────────────── */
function ActivityRow({
  activity, index, total, onEdit, onRemove, onMove, busy,
}: {
  activity: LessonActivityDto;
  index: number;
  total: number;
  onEdit: () => void;
  onRemove: () => void;
  onMove: (delta: number) => void;
  busy: boolean;
}): JSX.Element {
  const { t } = useTranslation();
  const meta = activityMeta(activity.type);
  const [preview, setPreview] = useState(false);

  return (
    <div
      className="card gap-3"
      style={{ borderRadius: 16, borderLeft: `3px solid color-mix(in srgb, ${meta.color} 55%, transparent)` }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className="flex shrink-0 items-center justify-center rounded-2xl"
          style={{
            width: 38,
            height: 38,
            background: `color-mix(in srgb, ${meta.color} 22%, transparent)`,
            color: meta.color,
            fontSize: 19,
          }}
        >
          <i className={`ph-fill ${meta.icon}`} aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag tag-outline">{t(`activity.type_${activity.type}`)}</span>
            <p className="card-title truncate" style={{ fontSize: 15 }}>
              {activity.title || t(`activity.type_${activity.type}`)}
            </p>
          </div>
          <p className="card-meta truncate">{summaryLine(activity, t)}</p>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            className="btn btn-icon btn-ghost cx-press"
            title={t('activity.moveUp')}
            aria-label={t('activity.moveUp')}
            disabled={busy || index === 0}
            onClick={() => onMove(-1)}
          >
            <i className="ph ph-arrow-up" aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost cx-press"
            title={t('activity.moveDown')}
            aria-label={t('activity.moveDown')}
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
          >
            <i className="ph ph-arrow-down" aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost cx-press"
            title={t('activity.preview')}
            aria-label={t('activity.preview')}
            onClick={() => setPreview((p) => !p)}
          >
            <i className={`ph ${preview ? 'ph-eye-slash' : 'ph-eye'}`} aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost cx-press"
            title={t('common.edit')}
            aria-label={t('common.edit')}
            onClick={onEdit}
          >
            <i className="ph ph-pencil" aria-hidden />
          </button>
          <button
            type="button"
            className="btn btn-icon btn-ghost cx-press"
            title={t('common.delete')}
            aria-label={t('common.delete')}
            disabled={busy}
            onClick={onRemove}
          >
            <i className="ph ph-trash" aria-hidden />
          </button>
        </div>
      </div>

      {preview && <ActivityPreview activity={activity} />}
    </div>
  );
}

function ActivityPreview({ activity }: { activity: LessonActivityDto }): JSX.Element {
  const { t } = useTranslation();
  if (activity.type === 'markdown' && activity.contentMd) return <MarkdownBlock content={activity.contentMd} />;
  if (activity.type === 'pdf' && activity.fileId) {
    return <PdfBlock fileId={activity.fileId} fileName={activity.fileName} />;
  }
  if (activity.type === 'video' && activity.videoUrl) return <VideoBlock videoUrl={activity.videoUrl} />;
  return <p className="text-muted text-sm">{t('activity.refPreviewHint')}</p>;
}

function summaryLine(a: LessonActivityDto, t: (k: string, o?: Record<string, unknown>) => string): string {
  switch (a.type) {
    case 'markdown':
      return (a.contentMd ?? '').replace(/\s+/g, ' ').trim().slice(0, 120) || '—';
    case 'pdf':
      return a.fileName ?? '—';
    case 'video':
      return a.videoUrl ?? '—';
    default:
      return a.refTitle ?? t('activity.refMissing');
  }
}

/* ── Form thêm activity ──────────────────────────────────────────────────── */
function AddActivityForm({
  courseId, sectionId, lessonId,
}: { courseId: string; sectionId: string; lessonId: string }): JSX.Element {
  const { t } = useTranslation();
  const [type, setType] = useState<LessonActivityTypeValue>('markdown');
  const add = useAddActivity(courseId, sectionId, lessonId);

  return (
    <div className="space-y-3 border-t pt-4" style={{ borderColor: 'var(--color-divider)' }}>
      <p className="cx-display" style={{ fontSize: 15 }}>{t('activity.addHeading')}</p>
      <div className="seg flex-wrap">
        {LESSON_ACTIVITY_TYPES.map((ty) => (
          <button
            key={ty}
            type="button"
            className={`seg-btn cx-press ${type === ty ? 'seg-active' : ''}`}
            onClick={() => setType(ty)}
          >
            <i className={`ph ${activityMeta(ty).icon}`} aria-hidden /> {t(`activity.type_${ty}`)}
          </button>
        ))}
      </div>

      <ActivityFields
        key={type}
        type={type}
        courseId={courseId}
        submitting={add.isPending}
        submitLabel={t('activity.add')}
        error={add.isError ? errMsg(add.error) : null}
        onSubmit={(body) => add.mutate({ ...body, type } as CreateLessonActivityRequest)}
      />
    </div>
  );
}

/* ── Form sửa activity (giữ nguyên loại) ─────────────────────────────────── */
function ActivityEditor({
  courseId, sectionId, lessonId, activity, onDone,
}: {
  courseId: string;
  sectionId: string;
  lessonId: string;
  activity: LessonActivityDto;
  onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const update = useUpdateActivity(courseId, sectionId, lessonId);

  return (
    <div className="card gap-3" style={{ borderRadius: 16, outline: '1px solid var(--color-accent-700)' }}>
      <div className="flex items-center justify-between gap-2">
        <p className="cx-display" style={{ fontSize: 15 }}>
          {t('activity.editHeading', { type: t(`activity.type_${activity.type}`) })}
        </p>
        <button type="button" className="btn btn-ghost cx-press" onClick={onDone}>
          {t('common.cancel')}
        </button>
      </div>
      <ActivityFields
        type={activity.type}
        courseId={courseId}
        initial={activity}
        submitting={update.isPending}
        submitLabel={t('common.save')}
        error={update.isError ? errMsg(update.error) : null}
        onSubmit={(body) => update.mutate({ activityId: activity.id, body }, { onSuccess: onDone })}
      />
    </div>
  );
}

/* ── Trường nhập theo loại activity ──────────────────────────────────────── */
function ActivityFields({
  type, courseId, initial, submitting, submitLabel, error, onSubmit,
}: {
  type: LessonActivityTypeValue;
  courseId: string;
  initial?: LessonActivityDto;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  onSubmit: (body: {
    title?: string;
    contentMd?: string;
    fileId?: string;
    videoUrl?: string;
    refId?: string;
  }) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [title, setTitle] = useState(initial?.title ?? '');
  const [contentMd, setContentMd] = useState(initial?.contentMd ?? '');
  const [videoUrl, setVideoUrl] = useState(initial?.videoUrl ?? '');
  const [refId, setRefId] = useState(initial?.refId ?? '');
  const [fileId, setFileId] = useState(initial?.fileId ?? '');
  const [fileName, setFileName] = useState(initial?.fileName ?? '');
  const upload = useUploadFile();

  const isRef = type === 'quiz' || type === 'coding' || type === 'assignment';
  const canSubmit =
    (type === 'markdown' && contentMd.trim().length > 0) ||
    (type === 'pdf' && fileId.length > 0) ||
    (type === 'video' && videoUrl.trim().length > 0) ||
    (isRef && refId.length > 0);

  const submit = () => {
    const body: Record<string, string> = { title: title.trim() };
    if (type === 'markdown') body.contentMd = contentMd;
    if (type === 'pdf') body.fileId = fileId;
    if (type === 'video') body.videoUrl = videoUrl.trim();
    if (isRef) body.refId = refId;
    onSubmit(body);
  };

  return (
    <div className="space-y-2">
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('activity.titleField')}
      />

      {type === 'markdown' && (
        <>
          <textarea
            className="input"
            rows={8}
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            placeholder={t('activity.markdownPlaceholder')}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', resize: 'vertical' }}
          />
          <p className="card-meta">{t('activity.markdownHint')}</p>
        </>
      )}

      {type === 'pdf' && (
        <div className="space-y-2">
          <input
            type="file"
            accept="application/pdf"
            className="input"
            disabled={upload.isPending}
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              upload.mutate(f, {
                onSuccess: (res) => {
                  setFileId(res.id);
                  setFileName(res.fileName ?? f.name);
                },
              });
            }}
          />
          <p className="card-meta">
            {t('activity.pdfHint', { size: Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024)) })}
          </p>
          {upload.isPending && <p className="text-muted text-sm">{t('activity.uploading')}</p>}
          {upload.isError && <p className="text-sm text-red-400">{errMsg(upload.error)}</p>}
          {fileId && (
            <p className="text-sm" style={{ color: 'var(--color-accent-300)' }}>
              <i className="ph ph-file-pdf" aria-hidden /> {fileName || fileId}
            </p>
          )}
        </div>
      )}

      {type === 'video' && (
        <>
          <input
            className="input"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="card-meta">{t('activity.videoHint')}</p>
        </>
      )}

      {isRef && <RefPicker type={type} courseId={courseId} value={refId} onChange={setRefId} />}

      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        type="button"
        className="btn btn-primary cx-press"
        disabled={submitting || !canSubmit}
        onClick={submit}
      >
        {submitLabel}
      </button>
    </div>
  );
}

/** Chọn Quiz / CodingProblem / Assignment sẵn có trong khóa để gắn vào bài học. */
function RefPicker({
  type, courseId, value, onChange,
}: {
  type: 'quiz' | 'coding' | 'assignment';
  courseId: string;
  value: string;
  onChange: (id: string) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const quizzes = useQuizzes(type === 'quiz' ? courseId : undefined);
  const coding = useCodingProblems(type === 'coding' ? courseId : undefined);
  const assignments = useAssignments(type === 'assignment' ? courseId : undefined);

  const options = useMemo(() => {
    if (type === 'quiz') return (quizzes.data?.items ?? []).map((x) => ({ id: x.id, title: x.title }));
    if (type === 'coding') return (coding.data?.items ?? []).map((x) => ({ id: x.id, title: x.title }));
    return (assignments.data?.items ?? []).map((x) => ({ id: x.id, title: x.title }));
  }, [type, quizzes.data, coding.data, assignments.data]);

  // Bỏ chọn nếu id hiện tại không còn trong khóa (vd đổi khóa/xoá bài tập).
  useEffect(() => {
    if (value && options.length > 0 && !options.some((o) => o.id === value)) {
      onChange('');
    }
  }, [options, value, onChange]);

  return (
    <div className="space-y-1">
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('activity.refPlaceholder')}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
      {options.length === 0 && <p className="card-meta">{t(`activity.refEmpty_${type}`)}</p>}
    </div>
  );
}
