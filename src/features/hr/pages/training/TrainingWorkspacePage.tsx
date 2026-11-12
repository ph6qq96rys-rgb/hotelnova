import TrainingLessons, { SafeMeetingLink } from './TrainingLessons';
import { useTrainingLanguage, TrainingLanguageBar } from './trainingLanguage';
import { Button } from '../../../../components/ui/button';
import { Input } from '../../../../components/ui/input';
import { Select } from '../../../../components/ui/select';
import { Textarea } from '../../../../components/ui/textarea';
import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { useHasPermission } from '../../../../auth/usePermissions';
import { trainingApi } from '../../api/hrApi';
import { trainingWorkspaceApi, type TrainingWorkspace, type TrainingCandidate, type TrainingEnrollmentRow } from '../../api/trainingWorkspaceApi';
import type { TrainingProgramDto } from '../../types';
import { fmtDate, getApiError } from '../../utils/hrUtils';
import './training.css';

export default function TrainingWorkspacePage() {
  const { tr, language } = useTrainingLanguage();
  const { companyId } = useAppScope(), { programId } = useParams<{ programId: string }>();
  const nav = useNavigate(), canManage = useHasPermission('hr.training.manage');
  const [program, setProgram] = useState<TrainingProgramDto | null>(null);
  const [data, setData] = useState<TrainingWorkspace | null>(null);
  const [error, setError] = useState(''), [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'lessons' | 'sessions'>('lessons'), [schedule, setSchedule] = useState(false);
  const [sessionId, setSessionId] = useState(''), [search, setSearch] = useState(''), [employeeId, setEmployeeId] = useState('');
  const [candidates, setCandidates] = useState<TrainingCandidate[]>([]);
  const [assessing, setAssessing] = useState<TrainingEnrollmentRow | null>(null);
  const [lessons, setLessons] = useState<string[]>([]), [checks, setChecks] = useState<string[]>([]);
  const sequence = useRef(0);
  const load = useCallback(async () => {
    if (!companyId || !programId) return;
    const n = ++sequence.current; setLoading(true); setError('');
    try {
      const [rows, detail] = await Promise.all([trainingApi.listPrograms(companyId, { language }), trainingWorkspaceApi.get(companyId, programId, language)]);
      if (n === sequence.current) { setProgram(rows.find(p => p.id === programId) ?? null); setData(detail); }
    } catch (e) { if (n === sequence.current) setError(getApiError(e, 'Could not load training.')); }
    finally { if (n === sequence.current) setLoading(false); }
  }, [companyId, programId, language]);
  useEffect(() => {
    setData(null); setProgram(null); setSessionId(''); setAssessing(null); setCandidates([]); setNotice('');
    void load(); return () => { sequence.current++; };
  }, [load]);
  async function save(action: () => Promise<unknown>, message: string) {
    setBusy(true); setError(''); setNotice('');
    try { await action(); setNotice(message); await load(); return true; }
    catch (e) { setError(getApiError(e, 'Could not save training.')); return false; }
    finally { setBusy(false); }
  }
  async function scheduleSession(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!companyId || !programId) return;
    const f = new FormData(e.currentTarget);
    if (await save(() => trainingApi.scheduleSession(companyId, { programId, startDate: f.get('date'), endDate: f.get('date'),
      startTime: `${f.get('start')}:00`, endTime: `${f.get('end')}:00`, location: f.get('venue'), meetingLink: f.get('meeting') || null, trainerName: f.get('trainer'), maxEnrollment: Number(f.get('capacity')) }), 'Session scheduled. Assign the employees who need this training.')) {
      setSchedule(false); setTab('sessions');
    }
  }
  async function findEmployees() {
    if (!companyId) return; const n = sequence.current; setBusy(true); setError('');
    try { const rows = await trainingWorkspaceApi.candidates(companyId, search); if (n === sequence.current) { setCandidates(rows); setEmployeeId(''); } }
    catch (e) { setError(getApiError(e, 'Could not find employees.')); } finally { setBusy(false); }
  }
  async function enroll(e: FormEvent) {
    e.preventDefault(); if (!companyId || !sessionId || !employeeId) return;
    if (await save(() => trainingApi.enroll(companyId, { sessionId, employeeId, enrollmentType: data?.curriculum ? 'Mandatory' : 'Nominated' }), 'Enrollment saved. Check the roster for enrollment or waiting-list status.')) setSessionId('');
  }
  async function assess(e: FormEvent<HTMLFormElement>) {
    e.preventDefault(); if (!companyId || !assessing) return;
    const f = new FormData(e.currentTarget), passed = f.get('outcome') === 'pass';
    if (await save(() => trainingApi.complete(companyId, assessing.id, { passed, score: Number(f.get('score')), attendancePercent: Number(f.get('attendance')),
      feedback: f.get('notes'), completedLessonIds: lessons, criticalChecks: checks, observedShiftDates: [f.get('shift1'), f.get('shift2')].filter(Boolean) }),
      passed ? 'Supervisor sign-off recorded.' : 'Coaching recorded. Arrange a new assessment enrollment after coaching.')) setAssessing(null);
  }
  const curriculum = data?.curriculum;
  const toggle = (v: string, rows: string[], set: (v: string[]) => void) => set(rows.includes(v) ? rows.filter(x => x !== v) : [...rows, v]);
  function evidence(row: TrainingEnrollmentRow) {
    if (!row.feedback) return <p>{tr("No assessment evidence recorded.")}</p>;
    try { const item = JSON.parse(row.feedback); return <div><p>{item.notes}</p><p>{tr("Assessor:")}{item.assessorName || 'Recorded supervisor'} · {fmtDate(item.assessedAtUtc)}</p>
      <p>{tr("Observed shifts:")}{(item.observedShiftDates ?? []).map((d: string) => fmtDate(d)).join(', ') || 'None'}</p><p>{tr("Curriculum")}{item.curriculumCode}{tr("· Version")}{item.curriculumVersion}</p></div>; }
    catch { return <p>{row.feedback}</p>; }
  }
  return <main className="page training-workspace" lang={language === 'am' ? 'am' : 'en'}><TrainingLanguageBar />
    <header className="page-header"><div><div className="page-kicker">{tr("Human Resources · Training")}</div><h1>{tr(data?.curriculum?.title ?? program?.title ?? 'Training programme')}</h1>
      <p>{program?.code}{curriculum && ` · ${tr('Version')} ${curriculum.version} · ${tr(curriculum.role)}`}</p></div>
      <div className="training-actions"><Button className="btn" onClick={() => nav(`/companies/${companyId}/hr/training`)}>{tr("All training")}</Button>
        {canManage && program && <Button className="btn btn-primary" onClick={() => setSchedule(!schedule)}>{tr("Schedule session")}</Button>}</div></header>
    {error && <div role="alert" className="alert alert-danger">{tr(error)}</div>}{notice && <p role="status">{tr(notice)}</p>}
    {loading && <p role="status">{tr("Loading training…")}</p>}{!loading && !program && !error && <p>{tr("Programme not found.")}</p>}
    {program && data && <>
      <section className="card"><p>{tr(data.objectives)}</p><p>{tr(data.description)}</p><p>{program.durationHours} {tr('planned learning hours')} · {tr(program.mode)} · {tr(curriculum ? 'Required for assigned employees, not every employee' : program.isMandatory ? 'Mandatory' : 'Optional')}</p>
        {curriculum && <p>{tr('Pass: {score}% knowledge score, full participation, every lesson and critical check, and {shifts} observed shifts.', { score: curriculum.passScore, shifts: curriculum.requiredObservedShifts })}</p>}</section>
      {canManage && schedule && <form className="card" onSubmit={scheduleSession} aria-label={tr("Schedule training session")}><h2>{tr("Schedule training session")}</h2><p>{tr("Use the branch’s local date and time.")}</p>
        <div className="training-grid"><label>{tr("Date")}<Input name="date" type="date" required /></label><label>{tr("Start time")}<Input name="start" type="time" defaultValue="09:00" required /></label>
          <label>{tr("End time")}<Input name="end" type="time" defaultValue="13:00" required /></label><label>{tr("Trainer")}<Input name="trainer" maxLength={150} required /></label>
          <label>{tr("Branch and venue")}<Input name="venue" maxLength={200} defaultValue="Online" /></label><label>{tr("Online meeting link")}<Input name="meeting" type="url" placeholder="https://…" /></label><label>{tr("Capacity")}<Input name="capacity" type="number" min="1" step="1" defaultValue="20" required /></label></div>
        <Button className="btn btn-primary" disabled={busy}>{tr("Save session")}</Button></form>}
      <nav className="training-actions" aria-label={tr("Training sections")}><Button className="btn" aria-pressed={tab === 'lessons'} onClick={() => setTab('lessons')}>{tr("Lessons and practice")}</Button>
        <Button className="btn" aria-pressed={tab === 'sessions'} onClick={() => setTab('sessions')}>{tr("Sessions and progress")}</Button></nav>
      {tab === 'lessons' && (curriculum ? <TrainingLessons curriculum={curriculum} /> : <p>{tr('Use the programme objectives and trainer-provided materials.')}</p>)}
      {tab === 'sessions' && <section>{!data.sessions.length && <div className="card"><h2>{tr("No sessions scheduled")}</h2><p>{tr("Schedule a session and assign employees to the appropriate role track.")}</p></div>}
        {data.sessions.map(s => <article className="card" key={s.id}><h2>{s.sessionNo}</h2><p>{fmtDate(s.startDate)} · {s.startTime.slice(0, 5)}–{s.endTime.slice(0, 5)} · {tr(s.location || 'Venue not recorded')}</p>
          <p>{tr("Trainer:")}{s.trainerName || tr('Not assigned')} · {tr(s.status)} · {s.enrolledCount} / {s.maxEnrollment || tr('Unlimited')}{tr("places")}</p>
          <SafeMeetingLink href={s.meetingLink} />{canManage && s.status === 'Scheduled' && <Button className="btn" onClick={() => { setSessionId(s.id); setCandidates([]); setEmployeeId(''); }}>{tr("Enroll employee")}</Button>}
          {canManage && <div className="training-table"><table className="table"><thead><tr><th>{tr("Employee")}</th><th>{tr("Status")}</th><th>{tr("Score")}</th><th>{tr("Result")}</th></tr></thead><tbody>{s.enrollments.map(row => <tr key={row.id}>
            <td>{row.employeeName}<Button variant="outline" onClick={() => nav(`/companies/${companyId}/hr/my-training/${row.id}`)}>{tr("Assist online learning")}</Button></td><td>{tr(row.status)}</td><td>{row.score == null ? tr('Not assessed') : `${row.score}%`}</td><td>{['Enrolled', 'InProgress'].includes(row.status) && !['Cancelled','Postponed'].includes(s.status)
              ? <Button className="btn" onClick={() => { setAssessing(row); setLessons([]); setChecks([]); }}>{tr('Assess {name}', {name: row.employeeName})}</Button>
              : <details><summary>{tr("View record")}</summary>{evidence(row)}</details>}</td></tr>)}</tbody></table>{!s.enrollments.length && <p>{tr("No employees enrolled.")}</p>}</div>}</article>)}</section>}
      {canManage && sessionId && <form className="card" onSubmit={enroll} aria-label={tr("Enroll employee")}><h2>{tr("Enroll employee")}</h2>
        <label>{tr("Find employee by name or number")}<Input value={search} onChange={e => setSearch(e.target.value)} /></label><Button type="button" className="btn" disabled={busy} onClick={findEmployees}>{tr("Find employees")}</Button>
        <label>{tr("Employee")}<Select value={employeeId} onChange={e => setEmployeeId(e.target.value)} required><option value="">{tr("Choose an employee")}</option>{candidates.map(c => <option value={c.id} key={c.id}>{c.name} · {c.employeeNo}</option>)}</Select></label>
        <p>{tr("Up to 50 matches are shown. Narrow the search if needed.")}</p><div className="training-actions"><Button className="btn btn-primary" disabled={busy || !employeeId}>{tr("Save enrollment")}</Button><Button type="button" className="btn" onClick={() => setSessionId('')}>{tr("Cancel enrollment")}</Button></div></form>}
      {canManage && assessing && <form className="card" key={assessing.id} onSubmit={assess} aria-label={tr("Supervisor assessment")}><h2>{tr('Supervisor assessment for {name}', {name: assessing.employeeName})}</h2>
        <p>{tr("Your signed-in identity and assessment time are saved. Completed results cannot be overwritten.")}</p>
        <div className="training-grid"><label>{tr("Knowledge score out of 100")}<Input name="score" type="number" min="0" max="100" step={curriculum ? '10' : '1'} required /></label>
          <label>{tr("Attendance percent")}<Input name="attendance" type="number" min="0" max="100" defaultValue="100" required /></label><label>{tr("Outcome")}<Select name="outcome"><option value="pass">{tr("Pass and sign off")}</option><option value="coaching">{tr("Needs coaching")}</option></Select></label></div>
        {curriculum && <><fieldset><legend>{tr("Lessons completed")}</legend>{curriculum.lessons.map(l => <label className="training-check" key={l.id}><Input type="checkbox" checked={lessons.includes(l.id)} onChange={() => toggle(l.id, lessons, setLessons)} />{tr(l.title)}</label>)}</fieldset>
          <fieldset><legend>{tr("Critical controls demonstrated")}</legend>{curriculum.criticalChecks.map((c, i) => <label className="training-check" key={c}><Input type="checkbox" checked={checks.includes(curriculum.criticalCheckIds?.[i] ?? c)} onChange={() => toggle(curriculum.criticalCheckIds?.[i] ?? c, checks, setChecks)} />{tr(c)}</label>)}</fieldset>
          <div className="training-grid"><label>{tr("First observed shift")}<Input name="shift1" type="date" /></label><label>{tr("Second observed shift")}<Input name="shift2" type="date" /></label></div></>}
        <label>{tr("Supervisor evidence and coaching notes")}<Textarea name="notes" rows={4} maxLength={4000} required /></label><div className="training-actions"><Button className="btn btn-primary" disabled={busy}>{tr("Record assessment")}</Button><Button className="btn" type="button" onClick={() => setAssessing(null)}>{tr("Cancel assessment")}</Button></div></form>}
    </>}
  </main>;
}
