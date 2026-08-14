import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeachCourses } from './teach/TeachCourses';
import { TeachClasses } from './teach/TeachClasses';
import { TeachAssignments } from './teach/TeachAssignments';
import { TeachCoding } from './teach/TeachCoding';

type Tab = 'courses' | 'classes' | 'assignments' | 'coding';

export function TeachHome(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('courses');

  return (
    <section className="space-y-4">
      <h1 className="text-xl font-semibold">{t('teach.title')}</h1>

      <div className="flex gap-1 border-b border-slate-200">
        {(['courses', 'classes', 'assignments', 'coding'] as const).map((k) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            className={`-mb-px border-b-2 px-3 py-2 text-sm ${
              tab === k
                ? 'border-slate-900 font-medium text-slate-900'
                : 'border-transparent text-slate-500 hover:text-slate-700'
            }`}
          >
            {t(`teach.tab_${k}`)}
          </button>
        ))}
      </div>

      {tab === 'courses' && <TeachCourses />}
      {tab === 'classes' && <TeachClasses />}
      {tab === 'assignments' && <TeachAssignments />}
      {tab === 'coding' && <TeachCoding />}
    </section>
  );
}
