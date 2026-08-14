import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { TeachCourses } from './teach/TeachCourses';
import { TeachClasses } from './teach/TeachClasses';
import { TeachAssignments } from './teach/TeachAssignments';
import { TeachCoding } from './teach/TeachCoding';
import { TeachQuiz } from './teach/TeachQuiz';

type Tab = 'courses' | 'classes' | 'assignments' | 'coding' | 'quiz';

const TABS: Tab[] = ['courses', 'classes', 'assignments', 'coding', 'quiz'];

export function TeachHome(): JSX.Element {
  const { t } = useTranslation();
  const [tab, setTab] = useState<Tab>('courses');

  return (
    <section className="space-y-4">
      <h1 className="text-xl">{t('teach.title')}</h1>

      <div className="seg flex-wrap">
        {TABS.map((k) => {
          const active = tab === k;
          return (
            <button
              key={k}
              onClick={() => setTab(k)}
              className="seg-opt"
              style={
                active
                  ? { color: 'var(--color-accent)', boxShadow: 'inset 0 0 0 1px var(--color-accent)' }
                  : undefined
              }
            >
              {t(`teach.tab_${k}`)}
            </button>
          );
        })}
      </div>

      {tab === 'courses' && <TeachCourses />}
      {tab === 'classes' && <TeachClasses />}
      {tab === 'assignments' && <TeachAssignments />}
      {tab === 'coding' && <TeachCoding />}
      {tab === 'quiz' && <TeachQuiz />}
    </section>
  );
}
