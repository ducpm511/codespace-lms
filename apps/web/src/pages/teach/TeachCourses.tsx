import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
import type { LessonSummary, SectionWithLessons } from '@lms/contracts';
import { ApiError } from '../../lib/api';
import {
  useAddLesson,
  useAddSection,
  useCourse,
  useCourses,
  useCreateCourse,
  usePublishCourse,
  useRemoveLesson,
  useRemoveSection,
  useUpdateLesson,
  useUpdateSection,
} from '../../features/courses/hooks';
import { LessonActivityBuilder } from './LessonActivityBuilder';
import {
  DetailColumn,
  DetailHeader,
  DetailSection,
  EmptyHint,
  IconButton,
  IconTile,
  PillButton,
  Sidebar,
  SidebarCard,
  TeachShell,
} from './teachUi';

/** Màu category theo trạng thái khóa học. */
const STATUS_COLOR: Record<string, string> = {
  published: 'var(--cx-teal)',
  archived: 'var(--cx-blue)',
  draft: 'var(--cx-amber)',
};
const statusColor = (s: string) => STATUS_COLOR[s] ?? 'var(--cx-purple)';

/** Màu + icon theo loại bài học (khớp bảng ở Learn). */
const LESSON_META: Record<string, { icon: string; color: string }> = {
  video: { icon: 'ph-video-camera', color: 'var(--cx-coral)' },
  article: { icon: 'ph-book-open', color: 'var(--cx-blue)' },
  interactive: { icon: 'ph-cursor-click', color: 'var(--cx-teal)' },
  coding: { icon: 'ph-code', color: 'var(--cx-teal)' },
  quiz: { icon: 'ph-check-square-offset', color: 'var(--cx-coral)' },
  assignment: { icon: 'ph-target', color: 'var(--cx-amber)' },
};
const lessonMeta = (type: string) => LESSON_META[type] ?? { icon: 'ph-book-bookmark', color: 'var(--cx-purple)' };

export function TeachCourses(): JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const courses = useCourses();

  return (
    <TeachShell
      sidebar={
        <Sidebar
          icon="ph-books"
          color="var(--cx-purple)"
          title={t('courses.heading')}
          count={courses.data?.total}
          footer={
            creating ? (
              <CreateCourseForm
                onCancel={() => setCreating(false)}
                onCreated={(id) => {
                  setSelected(id);
                  setCreating(false);
                }}
              />
            ) : (
              <PillButton icon="ph-plus" onClick={() => setCreating(true)}>
                {t('courses.create')}
              </PillButton>
            )
          }
        >
          {courses.isLoading && <p className="text-muted text-sm">{t('common.loading')}</p>}
          {courses.data?.items.length === 0 && <EmptyHint icon="ph-books">{t('courses.empty')}</EmptyHint>}
          {courses.data?.items.map((c) => (
            <SidebarCard
              key={c.id}
              icon="ph-book-bookmark"
              color={statusColor(c.status)}
              title={c.title}
              meta={`/${c.slug}`}
              selected={selected === c.id}
              onClick={() => setSelected(c.id)}
              tag={<StatusBadge status={c.status} />}
            />
          ))}
        </Sidebar>
      }
    >
      {selected ? (
        <CourseDetailPanel courseId={selected} />
      ) : (
        <EmptyHint icon="ph-hand-pointing">{t('courses.selectHint')}</EmptyHint>
      )}
    </TeachShell>
  );
}

function CreateCourseForm({
  onCreated,
  onCancel,
}: {
  onCreated: (id: string) => void;
  onCancel: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('');
  const create = useCreateCourse();

  const submit = (e: FormEvent) => {
    e.preventDefault();
    create.mutate(
      { slug: slug.trim(), title: title.trim() },
      {
        onSuccess: (c) => {
          setSlug('');
          setTitle('');
          onCreated(c.id);
        },
      },
    );
  };

  return (
    <form onSubmit={submit} className="card gap-2" style={{ borderRadius: 18 }}>
      <p className="cx-display m-0" style={{ fontSize: 14 }}>
        {t('courses.create')}
      </p>
      <input
        className="input"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('courses.titleField')}
        required
      />
      <input
        className="input"
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={t('courses.slug')}
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        title={t('courses.slugHint')}
        required
      />
      <div className="flex gap-2">
        <PillButton type="submit" disabled={create.isPending} icon="ph-plus">
          {t('courses.add')}
        </PillButton>
        <PillButton variant="secondary" onClick={onCancel}>
          {t('common.cancel')}
        </PillButton>
      </div>
      {create.isError && <p className="text-xs" style={{ color: '#f4a3a3' }}>{errMsg(create.error)}</p>}
    </form>
  );
}

function CourseDetailPanel({ courseId }: { courseId: string }): JSX.Element {
  const { t } = useTranslation();
  const course = useCourse(courseId);
  const addSection = useAddSection(courseId);
  const publish = usePublishCourse(courseId);
  const [addingSection, setAddingSection] = useState(false);
  const [sectionTitle, setSectionTitle] = useState('');
  // P7 — bài học đang mở trình soạn activity
  const [openLesson, setOpenLesson] = useState<{ sectionId: string; lessonId: string; title: string } | null>(null);

  if (course.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (course.isError || !course.data) return <p className="text-sm" style={{ color: '#f4a3a3' }}>{t('common.error')}</p>;
  const c = course.data;

  const lessonCount = c.sections.reduce((n, s) => n + s.lessons.length, 0);

  // Header khóa học ở lại phía trên KHI mở builder (design §7f) — chỉ cây chương/bài bị thay chỗ.
  const courseHeader = (
    <DetailHeader
      icon="ph-book-bookmark"
      color={statusColor(c.status)}
      title={c.title}
      meta={
        <span className="flex flex-wrap items-center gap-2">
          <span>/{c.slug}</span>
          <span aria-hidden>·</span>
          <span>{t('courses.treeMeta', { sections: c.sections.length, lessons: lessonCount })}</span>
        </span>
      }
      actions={
        <>
          <StatusBadge status={c.status} />
          {c.status !== 'published' && (
            <PillButton icon="ph-rocket-launch" onClick={() => publish.mutate()} disabled={publish.isPending}>
              {t('courses.publish')}
            </PillButton>
          )}
        </>
      }
    />
  );

  if (openLesson) {
    const section = c.sections.find((s) => s.id === openLesson.sectionId);
    return (
      <DetailColumn>
        {courseHeader}
        <LessonActivityBuilder
          courseId={courseId}
          sectionId={openLesson.sectionId}
          sectionTitle={section?.title}
          lessonId={openLesson.lessonId}
          lessonTitle={openLesson.title}
          onClose={() => setOpenLesson(null)}
        />
      </DetailColumn>
    );
  }

  return (
    <DetailColumn>
      {courseHeader}
      <DetailSection
        icon="ph-tree-structure"
        color="var(--cx-purple)"
        title={t('courses.treeHeading')}
        action={
          !addingSection && (
            <PillButton icon="ph-plus" variant="secondary" onClick={() => setAddingSection(true)}>
              {t('courses.addSection')}
            </PillButton>
          )
        }
      >
        {addingSection && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              addSection.mutate(
                { title: sectionTitle.trim() },
                {
                  onSuccess: () => {
                    setSectionTitle('');
                    setAddingSection(false);
                  },
                },
              );
            }}
            className="card flex-row flex-wrap items-center gap-2"
            style={{ borderRadius: 18 }}
          >
            <input
              className="input min-w-[200px] flex-1"
              value={sectionTitle}
              onChange={(e) => setSectionTitle(e.target.value)}
              placeholder={t('courses.sectionTitle')}
              autoFocus
              required
            />
            <PillButton type="submit" disabled={addSection.isPending} icon="ph-check">
              {t('courses.addSection')}
            </PillButton>
            <PillButton
              variant="secondary"
              onClick={() => {
                setAddingSection(false);
                setSectionTitle('');
              }}
            >
              {t('common.cancel')}
            </PillButton>
          </form>
        )}

        {c.sections.length === 0 && !addingSection && (
          <EmptyHint icon="ph-tree-structure">{t('courses.noSections')}</EmptyHint>
        )}

        {c.sections.map((s, idx) => (
          <SectionCard
            key={s.id}
            courseId={courseId}
            section={s}
            index={idx + 1}
            onOpenBuilder={(lesson) => setOpenLesson({ sectionId: s.id, lessonId: lesson.id, title: lesson.title })}
          />
        ))}
      </DetailSection>
    </DetailColumn>
  );
}

function SectionCard({
  courseId,
  section,
  index,
  onOpenBuilder,
}: {
  courseId: string;
  section: SectionWithLessons;
  index: number;
  onOpenBuilder: (lesson: LessonSummary) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const updateSection = useUpdateSection(courseId);
  const removeSection = useRemoveSection(courseId);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(section.title);
  const [addingLesson, setAddingLesson] = useState(false);

  return (
    <div className="card" style={{ borderRadius: 20, padding: 'var(--space-6)', gap: 'var(--space-4)' }}>
      <div className="flex flex-wrap items-center gap-2.5">
        <span
          className="cx-display flex shrink-0 items-center justify-center"
          style={{
            width: 30,
            height: 30,
            borderRadius: 10,
            fontSize: 14,
            background: 'color-mix(in srgb, var(--cx-purple) 20%, transparent)',
            color: 'var(--color-accent-300)',
          }}
        >
          {index}
        </span>

        {editing ? (
          <form
            className="flex min-w-0 flex-1 items-center gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              if (!draftTitle.trim()) return;
              updateSection.mutate(
                { sectionId: section.id, body: { title: draftTitle.trim() } },
                { onSuccess: () => setEditing(false) },
              );
            }}
          >
            <input
              className="input min-w-0 flex-1"
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              autoFocus
            />
            <PillButton type="submit" icon="ph-check" disabled={updateSection.isPending}>
              {t('common.save')}
            </PillButton>
            <PillButton variant="secondary" onClick={() => setEditing(false)}>
              {t('common.cancel')}
            </PillButton>
          </form>
        ) : (
          <>
            <p className="cx-display m-0 min-w-0 flex-1 truncate" style={{ fontSize: 15 }}>
              {section.title}
            </p>
            <span className="tag tag-neutral shrink-0">
              {t('courses.lessonCount', { count: section.lessons.length })}
            </span>
            <IconButton
              icon="ph-pencil-simple"
              title={t('courses.editSection')}
              onClick={() => {
                setDraftTitle(section.title);
                setEditing(true);
              }}
            />
            <IconButton
              icon="ph-trash"
              tone="danger"
              title={t('courses.removeSection')}
              onClick={() => {
                if (confirm(t('courses.confirmRemoveSection', { title: section.title }))) {
                  removeSection.mutate(section.id);
                }
              }}
            />
          </>
        )}
      </div>

      <div className="flex flex-col">
        {section.lessons.length === 0 && (
          <p className="text-muted m-0 text-xs" style={{ paddingTop: 'var(--space-3)' }}>
            {t('courses.noLessons')}
          </p>
        )}
        {section.lessons.map((l) => (
          <LessonRow key={l.id} courseId={courseId} sectionId={section.id} lesson={l} onOpenBuilder={onOpenBuilder} />
        ))}
      </div>

      {addingLesson ? (
        <AddLessonForm courseId={courseId} sectionId={section.id} onDone={() => setAddingLesson(false)} />
      ) : (
        <div>
          <PillButton icon="ph-plus" variant="ghost" onClick={() => setAddingLesson(true)}>
            {t('courses.addLessonToSection')}
          </PillButton>
        </div>
      )}
    </div>
  );
}

function LessonRow({
  courseId,
  sectionId,
  lesson,
  onOpenBuilder,
}: {
  courseId: string;
  sectionId: string;
  lesson: LessonSummary;
  onOpenBuilder: (lesson: LessonSummary) => void;
}): JSX.Element {
  const { t } = useTranslation();
  const updateLesson = useUpdateLesson(courseId);
  const removeLesson = useRemoveLesson(courseId);
  const [editing, setEditing] = useState(false);
  const [draftTitle, setDraftTitle] = useState(lesson.title);
  const meta = lessonMeta(lesson.type);

  return (
    <div
      className="flex flex-wrap items-center gap-3"
      style={{ borderTop: '1px solid var(--color-divider)', padding: 'var(--space-3) 0' }}
    >
      {editing ? (
        <form
          className="flex min-w-0 flex-1 items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            if (!draftTitle.trim()) return;
            updateLesson.mutate(
              { sectionId, lessonId: lesson.id, body: { title: draftTitle.trim() } },
              { onSuccess: () => setEditing(false) },
            );
          }}
        >
          <input
            className="input min-w-0 flex-1"
            value={draftTitle}
            onChange={(e) => setDraftTitle(e.target.value)}
            autoFocus
          />
          <PillButton type="submit" icon="ph-check" disabled={updateLesson.isPending}>
            {t('common.save')}
          </PillButton>
          <PillButton variant="secondary" onClick={() => setEditing(false)}>
            {t('common.cancel')}
          </PillButton>
        </form>
      ) : (
        <>
          <IconTile icon={meta.icon} color={meta.color} size={34} />
          <div className="min-w-0 flex-1">
            <p className="m-0 truncate" style={{ fontSize: 14 }}>
              {lesson.title}
            </p>
            <p className="text-muted m-0 truncate" style={{ fontSize: 11 }}>
              {t(`lessonType.${lesson.type}`, { defaultValue: lesson.type })} ·{' '}
              {t('activity.count', { count: lesson.activityCount ?? 0 })}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1.5">
            <PillButton icon="ph-stack" variant="secondary" onClick={() => onOpenBuilder(lesson)}>
              {t('activity.manage')}
            </PillButton>
            <IconButton
              icon="ph-pencil-simple"
              title={t('courses.editLesson')}
              onClick={() => {
                setDraftTitle(lesson.title);
                setEditing(true);
              }}
            />
            <IconButton
              icon="ph-trash"
              tone="danger"
              title={t('courses.removeLesson')}
              onClick={() => {
                if (confirm(t('courses.confirmRemoveLesson', { title: lesson.title }))) {
                  removeLesson.mutate({ sectionId, lessonId: lesson.id });
                }
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}

function AddLessonForm({
  courseId,
  sectionId,
  onDone,
}: {
  courseId: string;
  sectionId: string;
  onDone: () => void;
}): JSX.Element {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const addLesson = useAddLesson(courseId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addLesson.mutate(
          { sectionId, body: { title: title.trim() } },
          {
            onSuccess: () => {
              setTitle('');
              onDone();
            },
          },
        );
      }}
      className="flex flex-wrap items-center gap-2"
      style={{ borderTop: '1px solid var(--color-divider)', paddingTop: 'var(--space-4)' }}
    >
      <input
        className="input min-w-[180px] flex-1"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('courses.lessonTitle')}
        autoFocus
        required
      />
      <PillButton type="submit" icon="ph-check" disabled={addLesson.isPending}>
        {t('courses.addLesson')}
      </PillButton>
      <PillButton variant="secondary" onClick={onDone}>
        {t('common.cancel')}
      </PillButton>
    </form>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const { t } = useTranslation();
  const cls =
    status === 'published' ? 'tag tag-accent' : status === 'archived' ? 'tag tag-neutral' : 'tag tag-outline';
  return <span className={cls}>{t(`courseStatus.${status}`, { defaultValue: status })}</span>;
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
