import { Button } from '../../../../components/ui/button';
import type { OnboardingCurriculum } from '../../api/trainingWorkspaceApi';
import { useTrainingLanguage } from './trainingLanguage';

export function SafeMeetingLink({ href }: { href?: string }) {
  const { tr } = useTrainingLanguage();
  if (!href) return null;
  try { const url = new URL(href); if (url.protocol !== 'https:') return null; } catch { return null; }
  return <a href={href} target="_blank" rel="noopener noreferrer">{tr('Join online session')}</a>;
}

export default function TrainingLessons({ curriculum }: { curriculum: OnboardingCurriculum }) {
  const { tr, language } = useTrainingLanguage();
  return <section className="training-materials" lang={language === 'am' ? 'am' : 'en'}>
    <header className="card"><h2>{tr(curriculum.title)}</h2><p>{tr(curriculum.objectives)}</p>
      <h3>{tr('Learn by listening and demonstrating')}</h3>
      <p>{tr('The trainer may read each step and question aloud in Amharic. Explain it in your own words, then demonstrate it. The supervisor may write your answer and evidence for you.')}</p>
      <p>{tr('On a shared tablet, verify the employee name before saving. Sign out before the next person uses the device. Never share a password.')}</p>
      <Button className="training-no-print" variant="outline" onClick={() => window.print()}>{tr('Print learning materials')}</Button>
    </header>
    {curriculum.lessons.map((l, i) => <article className="card" key={l.id}>
      <h2>{i + 1}. {tr(l.title)}</h2><p>{l.minutes} {tr('minutes')}</p>
      <ol>{l.content.map((text, step) => <li key={step}>{tr(text)}</li>)}</ol>
      <h3>{tr('Practical exercise')}</h3><p>{tr(l.exercise)}</p>
    </article>)}
    <section className="card"><h2>{tr('Knowledge practice')}</h2>
      <p>{tr('Ten questions, ten points for each correct answer. The supervisor records the score.')}</p>
      {curriculum.questions.map((q, i) => <article className="training-question" key={i}>
        <p>{i + 1}. {tr(q.question)}</p><details><summary>{tr('Show answer')}</summary><p>{tr(q.answer)}</p></details>
      </article>)}
      <h3>{tr('Critical controls demonstrated')}</h3><ul>{curriculum.criticalChecks.map(c => <li key={c}>{tr(c)}</li>)}</ul>
    </section>
  </section>;
}
