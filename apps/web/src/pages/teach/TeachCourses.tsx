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
} from '../../features/courses/hooks';

export function TeachCourses(): JSX.Element {
  const { t } = useTranslation();
  const [selected, setSelected] = useState<string | null>(null);
  const courses = useCourses();

  return (
    <div className="grid gap-4 md:grid-cols-[18rem_1fr]">
      <div className="space-y-4">
        <CreateCourseForm onCreated={(id) => setSelected(id)} />
        <div className="rounded-lg border border-slate-200 bg-white">
          <div className="border-b border-slate-100 px-3 py-2 text-sm font-medium">
            {t('courses.heading')}
            {courses.data && <span className="ml-2 text-slate-400">({courses.data.total})</span>}
          </div>
          {courses.isLoading && <p className="px-3 py-4 text-sm text-slate-500">{t('common.loading')}</p>}
          {courses.data?.items.length === 0 && (
            <p className="px-3 py-4 text-sm text-slate-500">{t('courses.empty')}</p>
          )}
          <ul>
            {courses.data?.items.map((c) => (
              <li key={c.id}>
                <button
                  onClick={() => setSelected(c.id)}
                  className={`flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 ${
                    selected === c.id ? 'bg-slate-100 font-medium' : ''
                  }`}
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
          <p className="rounded-lg border border-dashed border-slate-300 px-4 py-10 text-center text-sm text-slate-500">
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
    <form onSubmit={submit} className="space-y-2 rounded-lg border border-slate-200 bg-white p-3">
      <p className="text-sm font-medium">{t('courses.create')}</p>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('courses.titleField')}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <input
        value={slug}
        onChange={(e) => setSlug(e.target.value)}
        placeholder={t('courses.slug')}
        pattern="[a-z0-9]+(?:-[a-z0-9]+)*"
        title={t('courses.slugHint')}
        required
        className="w-full rounded border border-slate-300 px-2 py-1.5 text-sm"
      />
      <button
        type="submit"
        disabled={create.isPending}
        className="w-full rounded bg-slate-900 px-3 py-1.5 text-sm text-white hover:bg-slate-800 disabled:opacity-50"
      >
        {t('courses.add')}
      </button>
      {create.isError && <p className="text-xs text-red-600">{errMsg(create.error)}</p>}
    </form>
  );
}

function CourseDetailPanel({ courseId }: { courseId: string }): JSX.Element {
  const { t } = useTranslation();
  const course = useCourse(courseId);
  const addSection = useAddSection(courseId);
  const publish = usePublishCourse(courseId);
  const [sectionTitle, setSectionTitle] = useState('');

  if (course.isLoading) return <p className="text-sm text-slate-500">{t('common.loading')}</p>;
  if (course.isError || !course.data) return <p className="text-sm text-red-600">{t('common.error')}</p>;
  const c = course.data;

  return (
    <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{c.title}</h2>
          <p className="text-xs text-slate-400">{c.slug}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={c.status} />
          {c.status !== 'published' && (
            <button
              onClick={() => publish.mutate()}
              disabled={publish.isPending}
              className="rounded border border-emerald-600 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
            >
              {t('courses.publish')}
            </button>
          )}
        </div>
      </div>

      <div className="space-y-3">
        {c.sections.length === 0 && <p className="text-sm text-slate-500">{t('courses.noSections')}</p>}
        {c.sections.map((s) => (
          <div key={s.id} className="rounded border border-slate-200">
            <div className="border-b border-slate-100 bg-slate-50 px-3 py-2 text-sm font-medium">{s.title}</div>
            <ul className="divide-y divide-slate-100">
              {s.lessons.map((l) => (
                <li key={l.id} className="flex items-center justify-between px-3 py-1.5 text-sm">
                  <span>{l.title}</span>
                  <span className="text-xs text-slate-400">{t(`lessonType.${l.type}`, { defaultValue: l.type })}</span>
                </li>
              ))}
              {s.lessons.length === 0 && (
                <li className="px-3 py-1.5 text-xs text-slate-400">{t('courses.noLessons')}</li>
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
          value={sectionTitle}
          onChange={(e) => setSectionTitle(e.target.value)}
          placeholder={t('courses.sectionTitle')}
          required
          className="flex-1 rounded border border-slate-300 px-2 py-1.5 text-sm"
        />
        <button
          type="submit"
          disabled={addSection.isPending}
          className="rounded border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100 disabled:opacity-50"
        >
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
    >
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder={t('courses.lessonTitle')}
        required
        className="flex-1 rounded border border-slate-300 px-2 py-1 text-xs"
      />
      <button
        type="submit"
        disabled={addLesson.isPending}
        className="rounded border border-slate-300 px-2 py-1 text-xs hover:bg-slate-100 disabled:opacity-50"
      >
        {t('courses.addLesson')}
      </button>
    </form>
  );
}

function StatusBadge({ status }: { status: string }): JSX.Element {
  const { t } = useTranslation();
  const cls =
    status === 'published'
      ? 'bg-emerald-100 text-emerald-700'
      : status === 'archived'
        ? 'bg-slate-200 text-slate-600'
        : 'bg-amber-100 text-amber-700';
  return <span className={`rounded px-1.5 py-0.5 text-xs ${cls}`}>{t(`courseStatus.${status}`, { defaultValue: status })}</span>;
}

function errMsg(e: unknown): string {
  return e instanceof ApiError ? e.message : String(e);
}
