import { useTrainingLanguage, TrainingLanguageBar } from './trainingLanguage';
import { Button } from '../../../../components/ui/button';
import { trainingApi } from '../../api/hrApi';
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppScope } from '../../../../app/useAppScope';
import { getApiError } from '../../utils/hrUtils';
import type { TrainingProgramDto, TrainingComplianceDto } from '../../types/index';
import { trainingWorkspaceApi } from '../../api/trainingWorkspaceApi';
import { useHasPermission } from '../../../../auth/usePermissions';

export default function TrainingPage() {
  const { tr, language } = useTrainingLanguage();
  const nav = useNavigate();
  const { companyId } = useAppScope();
  const canManage = useHasPermission('hr.training.manage');
  const [installing, setInstalling] = useState(false);
  const [notice, setNotice] = useState('');
  const trainingPath = `/companies/${companyId}/hr/training`;
  const [programs,    setPrograms]    = useState<TrainingProgramDto[]>([]);
  const [compliance,  setCompliance]  = useState<TrainingComplianceDto[]>([]);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [tab,         setTab]         = useState<'programs' | 'compliance'>('programs');

  const load = useCallback(async () => {
    if (!companyId) return;
    setLoading(true); setError(null);
    try {
      const [p, c] = await Promise.all([
        trainingApi.listPrograms(companyId, { language }),
        trainingApi.getComplianceReport(companyId),
      ]);
      setPrograms(p); setCompliance(c);
    } catch (e) { setError(getApiError(e, 'Failed to load training data.')); }
    finally { setLoading(false); }
  }, [companyId, language]);

  useEffect(() => { load(); }, [load]);

  async function installOnboarding() {
    if (!companyId) return;
    setInstalling(true); setError(null); setNotice('');
    try {
      const result = await trainingWorkspaceApi.install(companyId);
      await load();
      setNotice(result.added ? tr('Added {count} onboarding tracks. Open a track to read lessons, schedule training and assign employees.', {count: result.added}) : 'All four onboarding tracks are already available.');
    } catch (e) { setError(getApiError(e, 'Could not add onboarding tracks.')); }
    finally { setInstalling(false); }
  }

  async function online(action: 'install' | 'assign') {
    if (!companyId) return;
    setInstalling(true); setError(null); setNotice('');
    try {
      if (action === 'install') {
        const result = await trainingWorkspaceApi.installOnline(companyId);
        setNotice(tr('New online courses added: {count}.', {count: result.added}) + (result.unmatched.length ? ` ${tr('Roles needing a course')}: ${result.unmatched.join(', ')}` : ''));
      } else {
        const result = await trainingWorkspaceApi.assignRoles(companyId);
        setNotice(tr('Employees assigned: {count}. Existing assignments were retained.', {count: result.added}));
      }
      await load();
    } catch(e) { setError(getApiError(e, 'Could not save training.')); }
    finally { setInstalling(false); }
  }

  return (
    <div className="page training-workspace" lang={language === 'am' ? 'am' : 'en'}><TrainingLanguageBar />
      <div className="page-header">
        <div>
          <div className="page-kicker">{tr("Human Resources")}</div>
          <div className="page-title">{tr("Training")}</div>
          <div className="page-sub">{tr("Programs, sessions and compliance tracking")}</div>
        </div>
        {canManage && <Button className="btn btn-primary" onClick={() => nav(`${trainingPath}/programs/new`)}>{tr("+ New Program")}</Button>}
      </div>

      <section className="card" aria-label={tr('Online training for every Definite role')}>
        <h2>{tr('Online training for every Definite role')}</h2>
        <p>{tr('Learn on your phone or with a supervisor on a branch tablet. Reading and writing assistance is allowed; competence must still be demonstrated.')}</p>
        <Button variant="outline" onClick={() => nav(`/companies/${companyId}/hr/my-training`)}>{tr('My online training')}</Button>
        {canManage && <><div className="training-actions">
          <Button disabled={installing} onClick={() => void online('install')}>{tr('Add online courses for all roles')}</Button>
          <Button variant="outline" disabled={installing} onClick={() => void online('assign')}>{tr('Assign active employees by job role')}</Button>
        </div><p>{tr('Role assignment enrolls active employees in their matching installed course for a 30-day learning window. It does not grant a pass or send messages.')}</p></>}
      </section>
      <section className="card" style={{ marginBottom: 20 }} aria-label={tr("Staff onboarding")}>
        <h2>{tr("Staff onboarding")}</h2>
        <p>{tr("Manager, waiter, chef and barista tracks with shared lessons, practical exercises and supervisor sign-off.")}</p>
        <p>{tr("Assign the appropriate track to each employee. Adding tracks does not enroll everyone or mark them trained.")}</p>
        {canManage && <Button className="btn btn-primary" disabled={installing} onClick={installOnboarding}>{installing ? 'Adding tracks…' : 'Add staff onboarding tracks'}</Button>}
        {notice && <p role="status">{tr(notice)}</p>}
      </section>

      <div className="kpi-grid" style={{ gridTemplateColumns: 'repeat(4,1fr)', marginBottom: 20 }}>
        <div className="kpi"><div className="kpi-label">{tr("Programs")}</div>
          <div className="kpi-val">{programs.length}</div></div>
        <div className="kpi"><div className="kpi-label">{tr("Mandatory")}</div>
          <div className="kpi-val">{programs.filter(p => p.isMandatory).length}</div></div>
        <div className="kpi"><div className="kpi-label">{tr("Avg Compliance")}</div>
          <div className="kpi-val">
            {compliance.length > 0
              ? (compliance.reduce((s,c) => s + c.compliancePercent, 0) / compliance.length).toFixed(0)
              : 0}%
          </div></div>
        <div className="kpi"><div className="kpi-label">{tr("Upcoming Sessions")}</div>
          <div className="kpi-val">{programs.reduce((s,p) => s + p.upcomingSessions, 0)}</div></div>
      </div>

      <div className="toolbar" style={{ marginBottom: 0 }}>
        {(['programs','compliance'] as const).map(t => (
          <Button key={t} className={`btn${tab === t ? ' btn-primary' : ''}`}
            onClick={() => setTab(t)} style={{ textTransform: 'capitalize' }}>
            {tr(t)}
          </Button>
        ))}
      </div>

      {error && <div className="alert alert-danger">{tr(error)}</div>}

      {tab === 'programs' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{tr("Code")}</th><th>{tr("Title")}</th><th>{tr("Category")}</th><th>{tr("Mode")}</th>
                <th style={{ textAlign: 'right' }}>{tr("Hours")}</th>
                <th style={{ textAlign: 'right' }}>{tr("Sessions")}</th>
                <th>{tr("Mandatory")}</th><th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} style={{ padding: 48, textAlign: 'center', color: 'var(--text-muted)' }}>{tr("Loading...")}</td></tr>
              ) : programs.map(p => (
                <tr key={p.id} style={{ cursor: 'pointer' }} onClick={() => nav(`${trainingPath}/programs/${p.id}`)}>
                  <td style={{ fontFamily: 'var(--mono)', fontSize: 12, color: 'var(--text-muted)' }}>{p.code}</td>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>
                    {tr(p.title)}
                    {p.provider && <div style={{ fontSize: 11, color: 'var(--text-soft)' }}>{tr(p.provider)}</div>}
                  </td>
                  <td style={{ fontSize: 12 }}>{tr(p.category)}</td>
                  <td style={{ fontSize: 12 }}>{tr(p.mode)}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{p.durationHours}{tr("h")}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{p.upcomingSessions}</td>
                  <td>{p.isMandatory ? <span className="badge badge-danger">{tr("Required")}</span> : <span className="badge badge-neutral">{tr(p.code.startsWith('ONB-') || p.code.startsWith('ONL-') ? 'Required when assigned' : 'Optional')}</span>}</td>
                  <td style={{ textAlign: 'right' }}><Button className="btn btn-sm">{tr("Open programme")}</Button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {tab === 'compliance' && (
        <div className="card" style={{ padding: 0 }}>
          <table className="table">
            <thead>
              <tr>
                <th>{tr("Employee")}</th><th>{tr("Department")}</th>
                <th style={{ textAlign: 'right' }}>{tr("Required")}</th>
                <th style={{ textAlign: 'right' }}>{tr("Completed")}</th>
                <th style={{ textAlign: 'right' }}>{tr("Compliance")}</th>
              </tr>
            </thead>
            <tbody>
              {compliance.map(c => (
                <tr key={c.employeeId}>
                  <td style={{ fontWeight: 500, fontSize: 13 }}>{c.employeeName}</td>
                  <td style={{ fontSize: 13 }}>{c.departmentName}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.mandatoryRequired}</td>
                  <td style={{ textAlign: 'right', fontFamily: 'var(--mono)', fontSize: 12 }}>{c.mandatoryCompleted}</td>
                  <td style={{ textAlign: 'right', minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, justifyContent: 'flex-end' }}>
                      <div style={{ flex: 1, height: 6, background: 'var(--border)', borderRadius: 3 }}>
                        <div style={{ height: '100%', borderRadius: 3,
                          background: c.compliancePercent >= 100 ? 'var(--success)'
                            : c.compliancePercent >= 60 ? 'var(--warn)' : 'var(--danger)',
                          width: `${Math.min(c.compliancePercent, 100)}%`,
                        }} />
                      </div>
                      <span style={{ fontSize: 12, fontFamily: 'var(--mono)', fontWeight: 600, width: 40, textAlign: 'right',
                        color: c.compliancePercent >= 100 ? 'var(--success)' : c.compliancePercent >= 60 ? 'var(--warn)' : 'var(--danger)' }}>
                        {c.compliancePercent.toFixed(0)}%
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
