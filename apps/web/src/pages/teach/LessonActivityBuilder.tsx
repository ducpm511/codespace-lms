import { useEffect, useMemo, useRef, useState } from 'react';
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
import { DetailColumn, DetailSection, EmptyHint, IconButton, IconTile, PillButton } from './teachUi';

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}

const ERROR_COLOR = '#f4a3a3';

/**
 * Trình soạn nội dung bài học (P7): danh sách activity có thứ tự — thêm / sửa / xoá / đổi thứ tự.
 * Thay chỗ cột cây khóa học (không mở route mới), vào bằng animation cx-pop.
 */
export function LessonActivityBuilder({
  courseId,
  sectionId,
  sectionTitle,
  lessonId,
  lessonTitle,
  onClose,
}: {
  courseId: string;
  sectionId: string;
  sectionTitle?: string;
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
    <DetailColumn>
      {/* Header band — gradient tím + dots + blob */}
      <div
        className="cx-dots relative overflow-hidden"
        style={{
          animation: 'cx-pop 0.3s ease',
          borderRadius: 'var(--cx-radius)',
          background:
            'linear-gradient(135deg, color-mix(in srgb, var(--cx-purple) 26%, var(--color-surface)), var(--color-surface))',
          padding: 'var(--space-6)',
        }}
      >
        <span
          className="cx-blob"
          style={{ width: 220, height: 220, top: -80, right: 40, background: 'var(--cx-purple)', opacity: 0.35 }}
          aria-hidden
        />
        <div className="relative z-10 flex flex-wrap items-center justify-between" style={{ gap: 'var(--space-4)' }}>
          <div className="flex min-w-0 flex-1 items-start gap-3.5" style={{ minWidth: 240 }}>
            <IconTile icon="ph-stack" color="var(--cx-purple)" />
            <div className="min-w-0 flex-1">
              <p className="m-0 text-[11px] uppercase tracking-[0.08em]" style={{ color: 'var(--color-accent-300)' }}>
                {t('activity.builderKicker')}
                {sectionTitle ? ` · ${sectionTitle}` : ''}
              </p>
              <h2 className="cx-display m-0 truncate" style={{ fontSize: 20, lineHeight: 1.25 }}>
                {lessonTitle}
              </h2>
              <p className="text-muted m-0" style={{ fontSize: 12, marginTop: 2 }}>
                {t('activity.countInLesson', { count: activities.length })}
              </p>
            </div>
          </div>
          <PillButton icon="ph-arrow-left" variant="secondary" onClick={onClose}>
            {t('activity.backToLessons')}
          </PillButton>
        </div>
      </div>

      {detail.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
      {detail.isError && <p className="text-sm" style={{ color: ERROR_COLOR }}>{errMsg(detail.error)}</p>}
      {reorder.isError && <p className="text-sm" style={{ color: ERROR_COLOR }}>{errMsg(reorder.error)}</p>}
      {remove.isError && <p className="text-sm" style={{ color: ERROR_COLOR }}>{errMsg(remove.error)}</p>}

      <DetailSection
        icon="ph-list-numbers"
        color="var(--cx-purple)"
        title={t('activity.orderHeading')}
        count={activities.length}
      >
        <p className="text-muted m-0" style={{ fontSize: 12, marginTop: -6 }}>
          {t('activity.orderHint')}
        </p>

        {detail.data && activities.length === 0 && <EmptyHint icon="ph-stack">{t('activity.empty')}</EmptyHint>}

        <ul className="flex list-none flex-col p-0" style={{ gap: 'var(--space-3)' }}>
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
      </DetailSection>

      <AddActivityForm courseId={courseId} sectionId={sectionId} lessonId={lessonId} />
    </DetailColumn>
  );
}

/* ── Một dòng activity (xem nhanh + hành động) ───────────────────────────── */
function ActivityRow({
  activity,
  index,
  total,
  onEdit,
  onRemove,
  onMove,
  busy,
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
      className="card"
      style={{
        borderRadius: 18,
        padding: 'var(--space-5)',
        gap: 'var(--space-3)',
        borderLeft: `3px solid ${meta.color}`,
      }}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span className="cx-display text-muted shrink-0" style={{ fontSize: 13, width: 16 }}>
          {index + 1}
        </span>
        <IconTile icon={meta.icon} color={meta.color} size={38} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="tag tag-outline shrink-0">{t(`activity.type_${activity.type}`)}</span>
            <p className="cx-display m-0 min-w-0 truncate" style={{ fontSize: 15 }}>
              {activity.title || t(`activity.type_${activity.type}`)}
            </p>
          </div>
          <p className="text-muted m-0 truncate" style={{ fontSize: 11, marginTop: 2 }}>
            {summaryLine(activity, t)}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <IconButton
            icon="ph-arrow-up"
            title={t('activity.moveUp')}
            disabled={busy || index === 0}
            onClick={() => onMove(-1)}
          />
          <IconButton
            icon="ph-arrow-down"
            title={t('activity.moveDown')}
            disabled={busy || index === total - 1}
            onClick={() => onMove(1)}
          />
          <IconButton
            icon={preview ? 'ph-eye-slash' : 'ph-eye'}
            title={t('activity.preview')}
            tone={preview ? 'accent' : 'neutral'}
            onClick={() => setPreview((p) => !p)}
          />
          <IconButton icon="ph-pencil-simple" title={t('common.edit')} onClick={onEdit} />
          <IconButton icon="ph-trash" tone="danger" title={t('common.delete')} disabled={busy} onClick={onRemove} />
        </div>
      </div>

      {preview && (
        <div
          style={{
            borderRadius: 14,
            background: 'var(--color-neutral-900)',
            boxShadow: 'inset 0 0 0 1px var(--color-divider)',
            padding: 'var(--space-5)',
          }}
        >
          <p className="text-muted m-0 flex items-center gap-1.5" style={{ fontSize: 11, marginBottom: 8 }}>
            <i className="ph ph-eye" aria-hidden /> {t('activity.previewHeading')}
          </p>
          <ActivityPreview activity={activity} />
        </div>
      )}
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
  return <p className="text-muted m-0 text-sm">{t('activity.refPreviewHint')}</p>;
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
  courseId,
  sectionId,
  lessonId,
}: {
  courseId: string;
  sectionId: string;
  lessonId: string;
}): JSX.Element {
  const { t } = useTranslation();
  const [type, setType] = useState<LessonActivityTypeValue>('markdown');
  const add = useAddActivity(courseId, sectionId, lessonId);

  return (
    <DetailSection icon="ph-plus-circle" color="var(--cx-teal)" title={t('activity.addNewHeading')}>
      <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
        <div className="flex flex-wrap gap-2">
          {LESSON_ACTIVITY_TYPES.map((ty) => {
            const meta = activityMeta(ty);
            const active = type === ty;
            return (
              <button
                key={ty}
                type="button"
                className="cx-press flex items-center gap-1.5"
                onClick={() => setType(ty)}
                style={{
                  borderRadius: 999,
                  padding: '7px 14px',
                  fontSize: 13,
                  color: active ? meta.color : 'var(--color-text)',
                  background: active ? `color-mix(in srgb, ${meta.color} 15%, transparent)` : 'transparent',
                  boxShadow: active
                    ? `inset 0 0 0 1.5px color-mix(in srgb, ${meta.color} 60%, transparent)`
                    : 'inset 0 0 0 1px var(--color-divider)',
                }}
              >
                <i className={`ph ${meta.icon}`} aria-hidden /> {t(`activity.type_${ty}`)}
              </button>
            );
          })}
        </div>

        <ActivityFields
          key={type}
          type={type}
          courseId={courseId}
          submitting={add.isPending}
          submitLabel={t('activity.addTyped', { type: t(`activity.type_${type}`) })}
          error={add.isError ? errMsg(add.error) : null}
          onSubmit={(body) => add.mutate({ ...body, type } as CreateLessonActivityRequest)}
        />
      </div>
    </DetailSection>
  );
}

/* ── Form sửa activity (giữ nguyên loại) ─────────────────────────────────── */
function ActivityEditor({
  courseId,
  sectionId,
  lessonId,
  activity,
  onDone,
}: {
  courseId: string;
  sectionId: string;
  lessonId: string;
  activity: LessonActivityDto;
  onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const update = useUpdateActivity(courseId, sectionId, lessonId);
  const meta = activityMeta(activity.type);

  return (
    <div
      className="card"
      style={{
        borderRadius: 18,
        padding: 'var(--space-5)',
        gap: 'var(--space-3)',
        borderLeft: `3px solid ${meta.color}`,
        outline: '1px solid var(--color-accent-700)',
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <IconTile icon={meta.icon} color={meta.color} size={34} />
          <p className="cx-display m-0 truncate" style={{ fontSize: 15 }}>
            {t('activity.editHeading', { type: t(`activity.type_${activity.type}`) })}
          </p>
        </div>
        <PillButton variant="ghost" onClick={onDone}>
          {t('common.cancel')}
        </PillButton>
      </div>
      <ActivityFields
        type={activity.type}
        courseId={courseId}
        initial={activity}
        submitting={update.isPending}
        submitLabel={t('common.save')}
        error={update.isError ? errMsg(update.error) : null}
        onSubmit={(body) => update.mutate({ activityId: activity.id, body }, { onSuccess: onDone })}
        onCancel={onDone}
      />
    </div>
  );
}

/* ── Trường nhập theo loại activity ──────────────────────────────────────── */
function ActivityFields({
  type,
  courseId,
  initial,
  submitting,
  submitLabel,
  error,
  onSubmit,
  onCancel,
}: {
  type: LessonActivityTypeValue;
  courseId: string;
  initial?: LessonActivityDto;
  submitting: boolean;
  submitLabel: string;
  error: string | null;
  onSubmit: (body: { title?: string; contentMd?: string; fileId?: string; videoUrl?: string; refId?: string }) => void;
  onCancel?: () => void;
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
    <div className="flex flex-col" style={{ gap: 'var(--space-3)' }}>
      <div className="field">
        <label>{t('activity.titleField')}</label>
        <input
          className="input"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder={t('activity.titlePlaceholder')}
        />
      </div>

      {type === 'markdown' && (
        <>
          <textarea
            className="input"
            rows={7}
            value={contentMd}
            onChange={(e) => setContentMd(e.target.value)}
            placeholder={t('activity.markdownPlaceholder')}
            style={{ fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace', resize: 'vertical' }}
          />
          <p className="text-muted m-0" style={{ fontSize: 11 }}>
            {t('activity.markdownHint')}
          </p>
        </>
      )}

      {type === 'pdf' && (
        <PdfDropZone
          fileId={fileId}
          fileName={fileName}
          uploading={upload.isPending}
          error={upload.isError ? errMsg(upload.error) : null}
          onPick={(f) =>
            upload.mutate(f, {
              onSuccess: (res) => {
                setFileId(res.id);
                setFileName(res.fileName ?? f.name);
              },
            })
          }
        />
      )}

      {type === 'video' && (
        <>
          <input
            className="input"
            value={videoUrl}
            onChange={(e) => setVideoUrl(e.target.value)}
            placeholder="https://www.youtube.com/watch?v=..."
          />
          <p className="text-muted m-0" style={{ fontSize: 11 }}>
            {t('activity.videoHint')}
          </p>
        </>
      )}

      {isRef && <RefPicker type={type} courseId={courseId} value={refId} onChange={setRefId} />}

      {error && <p className="m-0 text-sm" style={{ color: ERROR_COLOR }}>{error}</p>}

      <div className="flex flex-wrap items-center gap-2">
        <PillButton icon="ph-plus" disabled={submitting || !canSubmit} onClick={submit}>
          {submitLabel}
        </PillButton>
        {onCancel && (
          <PillButton variant="ghost" onClick={onCancel}>
            {t('common.cancel')}
          </PillButton>
        )}
      </div>
    </div>
  );
}

/** Vùng kéo-thả PDF (dashed coral). Server vẫn là nơi validate thật (mime + magic bytes + size). */
function PdfDropZone({
  fileId,
  fileName,
  uploading,
  error,
  onPick,
}: {
  fileId: string;
  fileName: string;
  uploading: boolean;
  error: string | null;
  onPick: (file: File) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const maxMb = Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024));

  return (
    <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          const f = e.dataTransfer.files?.[0];
          if (f) onPick(f);
        }}
        className="flex flex-col items-center justify-center gap-2 text-center"
        style={{
          borderRadius: 18,
          border: `1.5px dashed color-mix(in srgb, var(--cx-coral) ${dragging ? 90 : 55}%, transparent)`,
          background: dragging ? 'color-mix(in srgb, var(--cx-coral) 10%, transparent)' : 'transparent',
          padding: 'var(--space-7) var(--space-6)',
        }}
      >
        <i className="ph-fill ph-file-pdf" style={{ fontSize: 32, color: 'var(--cx-coral)' }} aria-hidden />
        <p className="m-0" style={{ fontSize: 14 }}>
          {t('activity.dropzoneTitle')}
        </p>
        <p className="text-muted m-0" style={{ fontSize: 11 }}>
          {t('activity.dropzoneHint', { size: maxMb })}
        </p>
        <PillButton icon="ph-upload-simple" variant="secondary" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {t('activity.choosePdf')}
        </PillButton>
        <input
          ref={inputRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          disabled={uploading}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onPick(f);
            e.target.value = '';
          }}
        />
      </div>

      <p className="text-muted m-0" style={{ fontSize: 11 }}>
        {t('activity.pdfHint', { size: maxMb })}
      </p>
      {uploading && <p className="text-muted m-0 text-sm">{t('activity.uploading')}</p>}
      {error && <p className="m-0 text-sm" style={{ color: ERROR_COLOR }}>{error}</p>}
      {fileId && (
        <span
          className="inline-flex items-center gap-1.5 self-start"
          style={{
            borderRadius: 999,
            padding: '5px 12px',
            fontSize: 12,
            color: 'var(--cx-coral)',
            background: 'color-mix(in srgb, var(--cx-coral) 15%, transparent)',
          }}
        >
          <i className="ph-fill ph-file-pdf" aria-hidden /> {fileName || fileId}
        </span>
      )}
    </div>
  );
}

/** Chọn Quiz / CodingProblem / Assignment sẵn có trong khóa để gắn vào bài học. */
function RefPicker({
  type,
  courseId,
  value,
  onChange,
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
    <div className="flex flex-col" style={{ gap: 'var(--space-2)' }}>
      <select className="input" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">{t('activity.refPlaceholder')}</option>
        {options.map((o) => (
          <option key={o.id} value={o.id}>
            {o.title}
          </option>
        ))}
      </select>
      <p className="text-muted m-0" style={{ fontSize: 11 }}>
        {options.length === 0 ? t(`activity.refEmpty_${type}`) : t('activity.refPreviewHint')}
      </p>
    </div>
  );
}
