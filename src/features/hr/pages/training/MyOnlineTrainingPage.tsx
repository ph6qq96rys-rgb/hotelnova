import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Textarea } from '../../../../components/ui/textarea';
import { onlineTrainingApi, type LearningDetail } from '../../api/trainingWorkspaceApi';
import { getApiError } from '../../utils/hrUtils';
import TrainingLessons, { SafeMeetingLink } from './TrainingLessons';
import { TrainingLanguageBar, useTrainingLanguage } from './trainingLanguage';
import './training.css';

export default function MyOnlineTrainingPage() {
  const { companyId } = useAppScope(), { enrollmentId } = useParams();
  const { language, tr } = useTrainingLanguage(), nav = useNavigate();
  const [data, setData] = useState<LearningDetail | null>(null);
  const [mine, setMine] = useState<Awaited<ReturnType<typeof onlineTrainingApi.mine>> | null>(null);
  const [lessons, setLessons] = useState<string[]>([]), [notes, setNotes] = useState('');
  const [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const seq = useRef(0);
  const load = useCallback(async () => {
    if (!companyId) return; const n = ++seq.current; setBusy(true); setError(''); setData(null); setMine(null);
    try {
      if (enrollmentId) {
        const d = await onlineTrainingApi.detail(companyId, enrollmentId, language);
        if (n !== seq.current) return;
        setData(d); setLessons(d.progress?.lessonIds ?? []); setNotes(d.progress?.evidence ?? '');
      } else { const d = await onlineTrainingApi.mine(companyId, language); if (n === seq.current) setMine(d); }
    } catch(e) { if (n === seq.current) setError(getApiError(e, 'Could not load training.')); }
    finally { if (n === seq.current) setBusy(false); }
  }, [companyId, enrollmentId, language]);
  useEffect(() => { setNotice(''); void load(); return () => { seq.current++; }; }, [load]);
  async function save() {
    if (!companyId || !data) return; setBusy(true); setError(''); setNotice('');
    try { const result = await onlineTrainingApi.save(companyId, data.id, { lessonIds: lessons, evidence: notes, version: data.progress?.version }); await load(); setNotice(result.message); }
    catch(e) { setError(getApiError(e, 'Could not save training.')); } finally { setBusy(false); }
  }
  return <main className="page training-workspace" lang={language === 'am' ? 'am' : 'en'}>
    <TrainingLanguageBar /><h1>{tr('My online training')}</h1>
    {error && <p role="alert">{tr(error)}</p>}{notice && <p role="status">{tr(notice)}</p>}{busy && <p role="status">{tr('Loading training…')}</p>}
    {mine && <>{!mine.linked ? <p>{tr('Your account is not linked to an employee. Ask HR to link the correct employee record.')}</p> : !mine.courses.length ? <p>{tr('No training is assigned yet. Ask your supervisor for your role course.')}</p> :
      <div className="training-grid">{mine.courses.map(c => <article className="card" key={c.id}><h2>{tr(c.title)}</h2><p>{tr(c.status)}</p>
        <Button onClick={() => nav(`/companies/${companyId}/hr/my-training/${c.id}`)}>{tr('Open programme')}</Button></article>)}</div>}</>}
    {data && <><div className="card training-no-print"><h2>{data.employeeName}</h2><p>{tr(data.status)} · {data.code}</p>
      {data.assisted && <p role="status">{tr('Assisted learning: progress will be saved for the employee named above, with your account recorded as the helper.')}</p>}
      <SafeMeetingLink href={data.meetingLink} /><Button variant="outline" onClick={() => nav(`/companies/${companyId}/hr/my-training`)}>{tr('My online training')}</Button></div>
      {data.curriculum ? <TrainingLessons curriculum={data.curriculum} /> : <p>{tr('Online learning materials are not available for this course.')}</p>}
      {data.curriculum && <section className="card training-no-print"><h2>{tr('My learning progress')}</h2>
        <p>{tr('Tick a lesson after studying it or discussing it with your trainer. This records learning, not a pass.')}</p>
        {data.curriculum.lessons.map(l => <label className="training-check" key={l.id}><Input type="checkbox" disabled={!data.canEdit || busy} checked={lessons.includes(l.id)}
          onChange={() => setLessons(lessons.includes(l.id) ? lessons.filter(id => id !== l.id) : [...lessons, l.id])} />{tr(l.title)}</label>)}
        <label>{tr('Practice evidence or help needed (optional)')}<Textarea maxLength={2000} rows={4} value={notes} disabled={!data.canEdit || busy} onChange={e => setNotes(e.target.value)} /></label>
        <p>{tr('You may explain your evidence aloud. A supervisor can record it for you on the assisted tablet. Do not include passwords or private customer information.')}</p>
        {data.canEdit && <Button disabled={busy} onClick={() => void save()}>{tr('Save learning progress')}</Button>}
        <Button variant="outline" disabled={busy} onClick={() => void load()}>{tr('Reload progress')}</Button>
      </section>}</>}
  </main>;
}
