import { useState } from 'react';
import type { FormEvent } from 'react';
import { useTranslation } from 'react-i18next';
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

export function TeachCourses(): JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const courses = useCourses();

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-4">
        <CreateCourseForm onCreated={(id) => setSelected(id)} />
        <div className="panel overflow-hidden">
          <div className="panel-head flex items-center gap-2">
            {t('courses.heading')}
            {courses.data && <span className="text-muted">({courses.data.total})</span>}
          </div>
          {courses.isLoading && <p className="text-muted px-3 py-4 text-sm">{t('common.loading')}</p>}
          {courses.data?.items.length === 0 && (
            <p className="text-muted px-3 py-4 text-sm">{t('courses.empty')}</p>
          )}
          <ul>
            {courses.data?.items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-white/5"
                  style={selected === c.id ? { background: 'color-mix(in srgb, var(--color-accent) 12%, transparent)' } : undefined}
                >
                  <span className="truncate">{c.title}</span>
                  <StatusBadge status={c.status} />
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div>
        {selected ? (
          <CourseDetailPanel courseId={selected} />
        ) : (
          <p className="text-muted rounded-lg border border-dashed px-4 py-10 text-center text-sm" style={{ borderColor: 'var(--color-divider)' }}>
            {t('courses.selectHint')}
          </p>
        )}
      </div>
    </div>
  );
}

function CreateCourseForm({ onCreated }: { onCreated: (id: string) => void }): JSX.Element {
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
    <form onSubmit={submit} className="card gap-2">
      <p className="card-title">{t('courses.create')}</p>
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
      <button type="submit" disabled={create.isPending} className="btn btn-primary btn-block">
        {t('courses.add')}
      </button>
      {create.isError && <p className="text-xs text-red-400">{errMsg(create.error)}</p>}
    </form>
  );
}

function CourseDetailPanel({ courseId }: { courseId: string }): JSX.Element {
  const { t } = useTranslation();
  const course = useCourse(courseId);
  const addSection = useAddSection(courseId);
  const updateSection = useUpdateSection(courseId);
  const removeSection = useRemoveSection(courseId);
  const updateLesson = useUpdateLesson(courseId);
  const removeLesson = useRemoveLesson(courseId);
  const publish = usePublishCourse(courseId);
  const [sectionTitle, setSectionTitle] = useState('');

  // Inline editing state
  const [editingSectionId, setEditingSectionId] = useState<string | null>(null);
  const [editingSectionTitle, setEditingSectionTitle] = useState('');
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);
  const [editingLessonTitle, setEditingLessonTitle] = useState('');

  if (course.isLoading) return <p className="text-muted text-sm">{t('common.loading')}</p>;
  if (course.isError || !course.data) return <p className="text-sm text-red-400">{t('common.error')}</p>;
  const c = course.data;

  return (
    <div className="card gap-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg">{c.title}</h2>
          <p className="text-muted text-xs">{c.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} />
          {c.status !== 'published' && (
            <button onClick={() => publish.mutate()} disabled={publish.isPending} className="btn btn-primary">
              {t('courses.publish')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {c.sections.length === 0 && <p className="text-muted text-sm">{t('courses.noSections')}</p>}
        {c.sections.map((s) => (
          <div key={s.id} className="rounded-md" style={{ border: '1px solid var(--color-divider)' }}>
            <div className="chip rounded-b-none text-sm font-medium flex items-center justify-between gap-2">
              {editingSectionId === s.id ? (
                <div className="flex items-center gap-1 flex-1">
                  <input
                    className="input text-xs py-1 flex-1"
                    value={editingSectionTitle}
                    onChange={(e) => setEditingSectionTitle(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="btn btn-primary !py-0.5 !px-2 text-xs"
                    onClick={() => {
                      if (editingSectionTitle.trim()) {
                        updateSection.mutate(
                          { sectionId: s.id, body: { title: editingSectionTitle.trim() } },
                          { onSuccess: () => setEditingSectionId(null) },
                        );
                      }
                    }}
                  >
                    Lưu
                  </button>
                  <button
                    type="button"
                    className="btn btn-secondary !py-0.5 !px-2 text-xs"
                    onClick={() => setEditingSectionId(null)}
                  >
                    Hủy
                  </button>
                </div>
              ) : (
                <>
                  <span>{s.title}</span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-amber-400 p-1"
                      title="Sửa chương"
                      onClick={() => {
                        setEditingSectionId(s.id);
                        setEditingSectionTitle(s.title);
                      }}
                    >
                      <i className="ph ph-pencil" />
                    </button>
                    <button
                      type="button"
                      className="text-xs text-slate-400 hover:text-rose-400 p-1"
                      title="Xóa chương"
                      onClick={() => {
                        if (confirm(`Xóa chương "${s.title}" và toàn bộ bài học bên trong?`)) {
                          removeSection.mutate(s.id);
                        }
                      }}
                    >
                      <i className="ph ph-trash" />
                    </button>
                  </div>
                </>
              )}
            </div>
            <ul>
              {s.lessons.map((l) => (
                <li
                  key={l.id}
                  className="flex items-center justify-between px-3 py-1.5 text-sm"
                  style={{ borderTop: '1px solid var(--color-divider)' }}
                >
                  {editingLessonId === l.id ? (
                    <div className="flex items-center gap-1 flex-1">
                      <input
                        className="input text-xs py-1 flex-1"
                        value={editingLessonTitle}
                        onChange={(e) => setEditingLessonTitle(e.target.value)}
                        autoFocus
                      />
                      <button
                        type="button"
                        className="btn btn-primary !py-0.5 !px-2 text-xs"
                        onClick={() => {
                          if (editingLessonTitle.trim()) {
                            updateLesson.mutate(
                              {
                                sectionId: s.id,
                                lessonId: l.id,
                                body: { title: editingLessonTitle.trim() },
                              },
                              { onSuccess: () => setEditingLessonId(null) },
                            );
                          }
                        }}
                      >
                        Lưu
                      </button>
                      <button
                        type="button"
                        className="btn btn-secondary !py-0.5 !px-2 text-xs"
                        onClick={() => setEditingLessonId(null)}
                      >
                        Hủy
                      </button>
                    </div>
                  ) : (
                    <>
                      <div className="flex items-center gap-2">
                        <span>{l.title}</span>
                        <span className="text-muted text-xs">
                          {t(`lessonType.${l.type}`, { defaultValue: l.type })}
                        </span>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-amber-400 p-1"
                          title="Sửa bài học"
                          onClick={() => {
                            setEditingLessonId(l.id);
                            setEditingLessonTitle(l.title);
                          }}
                        >
                          <i className="ph ph-pencil" />
                        </button>
                        <button
                          type="button"
                          className="text-xs text-slate-400 hover:text-rose-400 p-1"
                          title="Xóa bài học"
                          onClick={() => {
                            if (confirm(`Xóa bài học "${l.title}"?`)) {
                              removeLesson.mutate({ sectionId: s.id, lessonId: l.id });
                            }
                          }}
                        >
                          <i className="ph ph-trash" />
                        </button>
                      </div>
                    </>
                  )}
                </li>
              ))}
              {s.lessons.length === 0 && (
                <li className="text-muted px-3 py-1.5 text-xs" style={{ borderTop: '1px solid var(--color-divider)' }}>
                  {t('courses.noLessons')}
                </li>
              )}
            </ul>
            <AddLessonForm courseId={courseId} sectionId={s.id} />
          </div>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          addSection.mutate({ title: sectionTitle.trim() }, { onSuccess: () => setSectionTitle('') });
        }}
        className="flex gap-2"
      >
        <input
          className="input flex-1"
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
          placeholder={t('courses.sectionTitle')}
          required
        />
        <button type="submit" disabled={addSection.isPending} className="btn btn-secondary shrink-0">
          {t('courses.addSection')}
        </button>
      </form>
    </div>
  );
}

function AddLessonForm({ courseId, sectionId }: { courseId: string; sectionId: string }): JSX.Element {
  const { t } = useTranslation();
  const [title, setTitle] = useState('');
  const addLesson = useAddLesson(courseId);
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        addLesson.mutate({ sectionId, body: { title: title.trim() } }, { onSuccess: () => setTitle('') });
      }}
      className="flex gap-2 px-3 py-2"
      style={{ borderTop: '1px solid var(--color-divider)' }}
    >
      <input
        className="input flex-1 text-xs"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('courses.lessonTitle')}
        required
      />
      <button type="submit" disabled={addLesson.isPending} className="btn btn-secondary shrink-0">
        {t('courses.addLesson')}
      </button>
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
