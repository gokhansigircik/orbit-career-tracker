import { FormEvent, useEffect, useMemo, useState } from 'react';

type Session = { userId: number; fullName: string; email: string; token: string };
type Application = { id: number; company: string; role: string; stage: 'Applied' | 'Interviewing' | 'Offer' | 'Rejected'; location: string; salaryBand: string; source: string; createdAt: string; interviews?: Array<{ id: number; kind: string; scheduledAt: string; note: string }> };
type Dashboard = { metrics: Array<{ label: string; value: string; trend: string }>; goals: Array<{ id: number; title: string; status: string; targetDate: string }>; byStage: Array<{ stage: string; count: number }>; upcomingInterviews: Array<{ id: number; company: string; role: string; kind: string; scheduledAt: string; note: string }> };

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8090/api';
const storageKey = 'orbit-career-session';

async function request(path: string, options: RequestInit = {}, token?: string) {
  const response = await fetch(`${apiBaseUrl}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...(options.headers ?? {})
    }
  });
  const json = await response.json();
  if (!response.ok || !json.success) throw new Error(json.message ?? 'Request failed');
  return json.data;
}

export default function App() {
  const [session, setSession] = useState<Session | null>(() => {
    const raw = localStorage.getItem(storageKey);
    return raw ? JSON.parse(raw) : null;
  });

  useEffect(() => {
    if (session) localStorage.setItem(storageKey, JSON.stringify(session));
    else localStorage.removeItem(storageKey);
  }, [session]);

  return session ? <DashboardView session={session} onLogout={() => setSession(null)} /> : <Landing onAuthenticated={setSession} />;
}

function Landing({ onAuthenticated }: { onAuthenticated: (session: Session) => void }) {
  const [mode, setMode] = useState<'register' | 'login'>('register');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError('');
    const formData = new FormData(event.currentTarget);
    const payload = Object.fromEntries(formData.entries()) as Record<string, string>;
    try {
      const data = await request(mode === 'register' ? '/auth/register' : '/auth/login', {
        method: 'POST',
        body: JSON.stringify(
          mode === 'register'
            ? { fullName: payload.fullName, email: payload.email, password: payload.password }
            : { email: payload.email, password: payload.password }
        )
      });
      onAuthenticated(data as Session);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="landing-shell orbit-bg">
      <section className="hero glass">
        <span className="eyebrow">Career operating system</span>
        <h1>The developer application tracker serious job hunts deserve.</h1>
        <p>
          Orbit turns scattered job searching into a focused pipeline: applications, interview loops, stage momentum,
          and weekly goals in one sharp dashboard.
        </p>
        <div className="stat-grid">
          <StatCard label="Pipeline clarity" value="100%" subtitle="every role in one system" />
          <StatCard label="Interview rhythm" value="7d" subtitle="weekly operating cadence" />
          <StatCard label="Focus" value="A" subtitle="goal tracking and momentum" />
        </div>
      </section>
      <section className="auth glass">
        <div className="tabs">
          <button className={mode === 'register' ? 'active' : ''} onClick={() => setMode('register')}>Create account</button>
          <button className={mode === 'login' ? 'active' : ''} onClick={() => setMode('login')}>Sign in</button>
        </div>
        <form className="stack" onSubmit={handleSubmit}>
          {mode === 'register' && <input name="fullName" placeholder="Full name" required />}
          <input name="email" type="email" placeholder="Email" required />
          <input name="password" type="password" placeholder="Password" minLength={8} required />
          {error && <p className="error">{error}</p>}
          <button className="primary" disabled={loading}>{loading ? 'Working…' : mode === 'register' ? 'Launch tracker' : 'Enter dashboard'}</button>
        </form>
      </section>
    </main>
  );
}

function DashboardView({ session, onLogout }: { session: Session; onLogout: () => void }) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [error, setError] = useState('');
  const [form, setForm] = useState({ company: 'Vercel', role: 'Frontend Engineer', location: 'Remote', salaryBand: '$120k-$150k', source: 'Referral' });
  const [interview, setInterview] = useState({ applicationId: 0, kind: 'Hiring manager', scheduledAt: '2026-07-03 14:00', note: 'Product thinking + React depth' });

  async function load() {
    try {
      const [apps, board] = await Promise.all([
        request('/applications', {}, session.token),
        request('/dashboard', {}, session.token)
      ]);
      const typedApps = apps as Application[];
      setApplications(typedApps);
      setDashboard(board as Dashboard);
      setInterview((current) => ({ ...current, applicationId: current.applicationId || typedApps[0]?.id || 0 }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Unable to load dashboard');
    }
  }

  useEffect(() => { void load(); }, [session.token]);

  const heroCards = useMemo(() => [
    { label: 'Candidate', value: session.fullName, subtitle: session.email },
    { label: 'Applications', value: String(applications.length), subtitle: 'active opportunities tracked' },
    { label: 'Interviews', value: String(dashboard?.upcomingInterviews.length ?? 0), subtitle: 'upcoming touchpoints' }
  ], [session, applications.length, dashboard?.upcomingInterviews.length]);

  async function createApplication(event: FormEvent) {
    event.preventDefault();
    await request('/applications', { method: 'POST', body: JSON.stringify(form) }, session.token);
    setForm({ company: 'Linear', role: 'Product Engineer', location: 'Remote', salaryBand: '$130k-$160k', source: 'Inbound' });
    await load();
  }

  async function moveStage(id: number, stage: Application['stage']) {
    await request(`/applications/${id}/stage`, { method: 'PATCH', body: JSON.stringify({ stage }) }, session.token);
    await load();
  }

  async function createInterview(event: FormEvent) {
    event.preventDefault();
    if (!interview.applicationId) return;
    await request('/interviews', { method: 'POST', body: JSON.stringify(interview) }, session.token);
    await load();
  }

  return (
    <main className="dashboard-shell orbit-bg">
      <aside className="sidebar glass">
        <div>
          <span className="eyebrow">Orbit</span>
          <h2>Career command center</h2>
          <p className="muted">A focused system for intentional job search execution.</p>
        </div>
        <div className="stack compact">
          <button className="chip active">Pipeline</button>
          <button className="chip">Goals</button>
          <button className="chip">Interviews</button>
          <button className="chip">Signals</button>
        </div>
        <button className="secondary" onClick={onLogout}>Log out</button>
      </aside>

      <section className="main-panel">
        <header className="banner glass">
          <div>
            <span className="eyebrow">Execution view</span>
            <h1>Stay intentional, {session.fullName.split(' ')[0]}</h1>
          </div>
          <div className="pill">Search system: active</div>
        </header>
        {error && <p className="error">{error}</p>}
        <section className="stat-grid">
          {heroCards.map((item) => <StatCard key={item.label} label={item.label} value={item.value} subtitle={item.subtitle} />)}
        </section>
        <section className="grid-two">
          <article className="panel glass">
            <span className="eyebrow">Application intake</span>
            <h3>Add a new opportunity</h3>
            <form className="stack compact" onSubmit={createApplication}>
              <input value={form.company} onChange={(event) => setForm({ ...form, company: event.target.value })} placeholder="Company" />
              <input value={form.role} onChange={(event) => setForm({ ...form, role: event.target.value })} placeholder="Role" />
              <input value={form.location} onChange={(event) => setForm({ ...form, location: event.target.value })} placeholder="Location" />
              <input value={form.salaryBand} onChange={(event) => setForm({ ...form, salaryBand: event.target.value })} placeholder="Salary band" />
              <input value={form.source} onChange={(event) => setForm({ ...form, source: event.target.value })} placeholder="Source" />
              <button className="primary">Add application</button>
            </form>
          </article>
          <article className="panel glass">
            <span className="eyebrow">Weekly scorecard</span>
            <h3>Dashboard metrics</h3>
            <div className="stack compact">
              {dashboard?.metrics.map((metric) => (
                <div className="row-card" key={metric.label}>
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <em>{metric.trend}</em>
                </div>
              ))}
            </div>
          </article>
        </section>
        <section className="grid-two">
          <article className="panel glass">
            <span className="eyebrow">Pipeline board</span>
            <h3>Tracked roles</h3>
            <div className="stack compact">
              {applications.map((application) => (
                <div className="card" key={application.id}>
                  <strong>{application.company} · {application.role}</strong>
                  <span>{application.location} · {application.salaryBand} · {application.source}</span>
                  <div className="pill-inline">
                    <span className="pill">{application.stage}</span>
                    <button className="mini" onClick={() => void moveStage(application.id, 'Interviewing')}>Interviewing</button>
                    <button className="mini" onClick={() => void moveStage(application.id, 'Offer')}>Offer</button>
                  </div>
                </div>
              ))}
            </div>
          </article>
          <article className="panel glass">
            <span className="eyebrow">Interview loop</span>
            <h3>Schedule next step</h3>
            <form className="stack compact" onSubmit={createInterview}>
              <select value={interview.applicationId} onChange={(event) => setInterview({ ...interview, applicationId: Number(event.target.value) })}>
                <option value={0}>Choose application</option>
                {applications.map((application) => <option key={application.id} value={application.id}>{application.company} · {application.role}</option>)}
              </select>
              <input value={interview.kind} onChange={(event) => setInterview({ ...interview, kind: event.target.value })} placeholder="Interview type" />
              <input value={interview.scheduledAt} onChange={(event) => setInterview({ ...interview, scheduledAt: event.target.value })} placeholder="Scheduled at" />
              <input value={interview.note} onChange={(event) => setInterview({ ...interview, note: event.target.value })} placeholder="Prep note" />
              <button className="primary" disabled={!applications.length}>Schedule interview</button>
            </form>
            <div className="stack compact top-gap">
              {dashboard?.upcomingInterviews.map((item) => (
                <div className="row-card" key={item.id}>
                  <div>
                    <strong>{item.company} · {item.role}</strong>
                    <div className="muted small">{item.kind} · {item.scheduledAt}</div>
                  </div>
                  <span>{item.note}</span>
                </div>
              ))}
            </div>
          </article>
        </section>
        <section className="grid-two">
          <article className="panel glass">
            <span className="eyebrow">Goals</span>
            <h3>Weekly commitments</h3>
            <div className="stack compact">
              {dashboard?.goals.map((goal) => (
                <div className="row-card" key={goal.id}>
                  <div>
                    <strong>{goal.title}</strong>
                    <div className="muted small">Target: {goal.targetDate}</div>
                  </div>
                  <span>{goal.status}</span>
                </div>
              ))}
            </div>
          </article>
          <article className="panel glass">
            <span className="eyebrow">Stage mix</span>
            <h3>Pipeline distribution</h3>
            <div className="stack compact">
              {dashboard?.byStage.map((item) => (
                <div className="row-card" key={item.stage}>
                  <span>{item.stage}</span>
                  <strong>{item.count}</strong>
                </div>
              ))}
            </div>
          </article>
        </section>
      </section>
    </main>
  );
}

function StatCard({ label, value, subtitle }: { label: string; value: string; subtitle: string }) {
  return (
    <article className="stat glass">
      <span>{label}</span>
      <h3>{value}</h3>
      <p>{subtitle}</p>
    </article>
  );
}
